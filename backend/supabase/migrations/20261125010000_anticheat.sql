-- ───────── 점수 조작 방지 (가벼운 서버 검증) ─────────
-- 1) 랭킹 표에서 기기 ID를 더 이상 공개하지 않음 (남의 기기 ID로 기록·닉네임을 바꾸는 것 차단)
-- 2) 판(session)마다 기록은 한 번, 승리는 한 사람만
-- 3) 사람(기기/계정)별·IP별 시간당 기록 횟수 제한
-- 4) 내 게임 기록(game_history) 점수 범위·시간당 저장 횟수 제한

-- 기록 로그 (제한 계산용, 3일 뒤 삭제). 클라이언트 접근 불가
create table if not exists record_log (
  id bigint generated always as identity primary key,
  key uuid not null,
  ip text,
  game text not null,
  session_id text not null,
  win boolean not null,
  created_at timestamptz not null default now(),
  unique (key, session_id)
);
create index if not exists record_log_key_idx on record_log (key, created_at desc);
create index if not exists record_log_ip_idx on record_log (ip, created_at desc);
alter table record_log enable row level security;

-- 한 판의 승자는 한 명만
create table if not exists session_wins (
  session_id text primary key,
  winner_key uuid not null,
  created_at timestamptz not null default now()
);
alter table session_wins enable row level security;

-- 요청 IP (Supabase API 게이트웨이가 넣어주는 헤더)
create or replace function request_ip() returns text language sql stable as $$
  select nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)), '');
$$;

-- 예전 함수(인자 4개)는 삭제: 예전 앱 버전에서 오는 기록은 무시돼요
drop function if exists record_game(uuid, text, text, boolean);

-- 게임 1판 기록. 반환값: ok / win-ignored / dup / rate / invalid
create or replace function record_game(p_device uuid, p_nickname text, p_avatar text, p_win boolean, p_game text, p_session text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_key uuid := coalesce(auth.uid(), p_device);
  v_ip text := request_ip();
  v_win boolean := coalesce(p_win, false);
  v_last timestamptz;
  v_status text := 'ok';
begin
  if v_key is null then return 'invalid'; end if;
  if p_nickname is null or char_length(trim(p_nickname)) not between 1 and 10 then return 'invalid'; end if;
  if p_avatar is null or char_length(p_avatar) > 20 then p_avatar := 'rabbit'; end if;
  if p_game is null or p_game not in ('apple','halli','draw','rush','block','spot','word','quiz','bomb','memory','pairs','merge','suika','omok','balance') then return 'invalid'; end if;
  if p_session is null or p_session !~ '^[A-Za-z0-9_-]{4,64}$' then return 'invalid'; end if;

  -- 같은 판 두 번 기록 금지
  if exists (select 1 from record_log where key = v_key and session_id = p_session) then return 'dup'; end if;
  -- 사람별: 20초 간격, 시간당 40판, 하루 300판
  select max(created_at) into v_last from record_log where key = v_key;
  if v_last is not null and v_last > now() - interval '20 seconds' then return 'rate'; end if;
  if (select count(*) from record_log where key = v_key and created_at > now() - interval '1 hour') >= 40 then return 'rate'; end if;
  if (select count(*) from record_log where key = v_key and created_at > now() - interval '1 day') >= 300 then return 'rate'; end if;
  -- IP별: 시간당 80판 (가짜 기기 ID를 여러 개 만들어도 같은 곳에서 오면 막힘)
  if v_ip is not null and (select count(*) from record_log where ip = v_ip and created_at > now() - interval '1 hour') >= 80 then return 'rate'; end if;

  if v_win then
    -- 사람별 시간당 승리 25번까지
    if (select count(*) from record_log where key = v_key and win and created_at > now() - interval '1 hour') >= 25 then
      v_win := false; v_status := 'win-ignored';
    else
      -- 이 판에서 이미 다른 사람이 이겼다고 기록했으면 승리 무효
      insert into session_wins (session_id, winner_key) values (p_session, v_key) on conflict (session_id) do nothing;
      if not found then v_win := false; v_status := 'win-ignored'; end if;
    end if;
  end if;

  insert into record_log (key, ip, game, session_id, win) values (v_key, v_ip, p_game, p_session, v_win);
  insert into player_stats (device_id, user_id, nickname, avatar, wins, games, updated_at)
  values (v_key, v_uid, trim(p_nickname), p_avatar, case when v_win then 1 else 0 end, 1, now())
  on conflict (device_id) do update set
    nickname = excluded.nickname, avatar = excluded.avatar,
    wins = player_stats.wins + case when v_win then 1 else 0 end,
    games = player_stats.games + 1, updated_at = now();
  return v_status;
end $$;
revoke all on function record_game(uuid, text, text, boolean, text, text) from public;
grant execute on function record_game(uuid, text, text, boolean, text, text) to anon, authenticated;

-- 랭킹 TOP N: 기기 ID 대신 "내 기록인지"만 알려줌
create or replace function top_players(p_device uuid, p_n int default 3)
returns table (nickname text, avatar text, wins int, games int, me boolean)
language sql stable security definer set search_path = public as $$
  select s.nickname, s.avatar, s.wins, s.games,
         (s.device_id = p_device or (auth.uid() is not null and (s.device_id = auth.uid() or s.user_id = auth.uid()))) as me
  from player_stats s
  where s.wins > 0
  order by s.wins desc, s.updated_at asc
  limit least(greatest(coalesce(p_n, 3), 1), 20);
$$;
revoke all on function top_players(uuid, int) from public;
grant execute on function top_players(uuid, int) to anon, authenticated;

-- 랭킹 표 직접 조회 막기 (top_players 함수로만)
drop policy if exists "read stats" on player_stats;
revoke select on player_stats from anon, authenticated;

-- ───────── 내 게임 기록(game_history) ─────────
-- 점수 범위 (기존 데이터는 검사하지 않음)
alter table game_history drop constraint if exists game_history_score_range;
alter table game_history add constraint game_history_score_range
  check (my_score between -10000 and 100000 and opp_score between -10000 and 100000) not valid;
alter table game_history drop constraint if exists game_history_game_check;
alter table game_history add constraint game_history_game_check
  check (game in ('apple','halli','draw','rush','block','spot','word','quiz','bomb','memory','pairs','merge','suika','omok','balance')) not valid;

alter table game_history add column if not exists inserted_at timestamptz not null default now();
-- 시간당 120건까지 저장 (로그인 때 폰 기록 50건을 한 번에 올리는 것까지는 허용), 미래 날짜 금지
create or replace function game_history_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.played_at > now() + interval '5 minutes' then new.played_at := now(); end if;
  new.inserted_at := now();
  if (select count(*) from game_history where user_id = new.user_id and inserted_at > now() - interval '1 hour') >= 120 then
    raise exception 'too many records' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists game_history_guard on game_history;
create trigger game_history_guard before insert on game_history for each row execute function game_history_guard();

-- ───────── 정리 작업에 추가 ─────────
create or replace function public.cleanup_old_data() returns void language sql security definer set search_path = public as $$
  delete from rooms where created_at < now() - interval '30 days';
  delete from players p where p.created_at < now() - interval '30 days' and not exists (select 1 from rooms r where r.host_id = p.id);
  delete from player_stats where user_id is null and updated_at < now() - interval '365 days';
  delete from reports where status <> 'open' and created_at < now() - interval '365 days';
  delete from record_log where created_at < now() - interval '3 days';
  delete from session_wins where created_at < now() - interval '3 days';
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;
