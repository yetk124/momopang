-- 둘이서 (DUO PLAY) — 초기 마이그레이션: 테이블 + RLS + 랭킹 함수
-- 적용: backend 폴더에서 `npm run db:push` (또는 대시보드 SQL Editor에 붙여넣기)
-- 실시간 게임 동기화는 Supabase Realtime(broadcast + presence)만으로 동작하고,
-- 이 테이블들은 방/결과 기록·랭킹용입니다.

-- ───────── 테이블 ─────────
create table if not exists players (
  id uuid primary key,
  nickname text not null check (char_length(nickname) between 1 and 10),
  avatar_id text not null default 'rabbit' check (char_length(avatar_id) <= 20),
  created_at timestamptz not null default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null check (room_code ~ '^[A-Z0-9]{6}$'),
  host_id uuid references players(id) on delete set null,
  status text not null default 'WAITING' check (status in ('WAITING', 'PLAYING', 'CLOSED')),
  current_game text check (char_length(current_game) <= 20),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists rooms_code_idx on rooms (room_code, created_at desc);

create table if not exists room_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  is_ready boolean not null default false,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  connection_status text not null default 'CONNECTED',
  primary key (room_id, player_id)
);

create table if not exists game_sessions (
  id uuid primary key,
  room_id uuid references rooms(id) on delete cascade,
  game_type text not null check (char_length(game_type) <= 20),
  status text not null default 'PLAYING',
  start_at timestamptz,
  end_at timestamptz,
  winner_id uuid,
  result jsonb check (pg_column_size(result) < 8192) -- 비정상적으로 큰 데이터 차단
);

create table if not exists game_state (
  session_id uuid primary key references game_sessions(id) on delete cascade,
  state jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists game_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references game_sessions(id) on delete cascade,
  player_id uuid,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ───────── RLS: 기본 전부 차단, 필요한 것만 허용 ─────────
alter table players enable row level security;
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table game_sessions enable row level security;
alter table game_state enable row level security;
alter table game_events enable row level security;

-- 게스트(anon/익명 로그인)는 "추가"만 가능. 수정·삭제·전체 조회 불가.
drop policy if exists "insert players" on players;
create policy "insert players" on players for insert to anon, authenticated with check (true);

drop policy if exists "insert rooms" on rooms;
create policy "insert rooms" on rooms for insert to anon, authenticated
  with check (status = 'WAITING' and (expires_at is null or expires_at < now() + interval '1 day'));

-- 방 조회는 최근 1일 이내 방만 (방 코드 확인용)
drop policy if exists "read recent rooms" on rooms;
create policy "read recent rooms" on rooms for select to anon, authenticated
  using (created_at > now() - interval '1 day');

drop policy if exists "insert sessions" on game_sessions;
create policy "insert sessions" on game_sessions for insert to anon, authenticated with check (true);
-- room_players / game_state / game_events 는 정책이 없으므로 클라이언트에서 접근 불가 (서버/Edge Function 전용)

-- ───────── 명예의 전당 (TOP 3 랭킹) ─────────
create table if not exists player_stats (
  device_id uuid primary key,
  nickname text not null check (char_length(nickname) between 1 and 10),
  avatar text not null default 'rabbit' check (char_length(avatar) <= 20),
  wins integer not null default 0 check (wins >= 0),
  games integer not null default 0 check (games >= 0),
  updated_at timestamptz not null default now()
);
create index if not exists player_stats_wins_idx on player_stats (wins desc, updated_at);
alter table player_stats enable row level security;
-- 순위 조회만 허용. 직접 추가/수정은 막고 아래 함수로만 기록.
drop policy if exists "read stats" on player_stats;
create policy "read stats" on player_stats for select to anon, authenticated using (true);

-- 게임 1판 기록: 같은 기기는 20초에 1번만 반영 (도배 방지)
create or replace function record_game(p_device uuid, p_nickname text, p_avatar text, p_win boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_last timestamptz;
begin
  if p_nickname is null or char_length(trim(p_nickname)) not between 1 and 10 then return; end if;
  if p_avatar is null or char_length(p_avatar) > 20 then p_avatar := 'rabbit'; end if;
  select updated_at into v_last from player_stats where device_id = p_device;
  if v_last is not null and v_last > now() - interval '20 seconds' then return; end if;
  insert into player_stats (device_id, nickname, avatar, wins, games, updated_at)
  values (p_device, trim(p_nickname), p_avatar, case when p_win then 1 else 0 end, 1, now())
  on conflict (device_id) do update set
    nickname = excluded.nickname, avatar = excluded.avatar,
    wins = player_stats.wins + case when p_win then 1 else 0 end,
    games = player_stats.games + 1, updated_at = now();
end $$;
revoke all on function record_game(uuid, text, text, boolean) from public;
grant execute on function record_game(uuid, text, text, boolean) to anon, authenticated;

-- ───────── (선택) 비공개 실시간 채널 ─────────
-- .env 에 VITE_SUPABASE_PRIVATE_CHANNELS=true 를 쓰는 경우에만 실행하세요.
-- 대시보드 > Authentication > Providers 에서 "Anonymous sign-ins" 를 켜야 합니다.
-- 로그인(익명 포함)한 사용자만 duo:로 시작하는 채널에 접속·송신할 수 있게 합니다.
-- drop policy if exists "duo channel read" on realtime.messages;
-- create policy "duo channel read" on realtime.messages for select to authenticated
--   using (realtime.topic() like 'duo:%');
-- drop policy if exists "duo channel write" on realtime.messages;
-- create policy "duo channel write" on realtime.messages for insert to authenticated
--   with check (realtime.topic() like 'duo:%');

-- ───────── 오래된 데이터 정리 (pg_cron 사용 시) ─────────
-- select cron.schedule('duo-cleanup', '0 4 * * *', $$
--   delete from rooms where created_at < now() - interval '30 days';
--   delete from players where created_at < now() - interval '30 days'
--     and id not in (select host_id from rooms where host_id is not null);
-- $$);
