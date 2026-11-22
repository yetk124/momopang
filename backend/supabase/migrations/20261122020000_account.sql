-- 카카오 계정 기능: 기록 서버 저장 · 랭킹 계정 기준 · 게스트 기록 합치기 · 회원 탈퇴
-- (20261122010000_profiles.sql 다음에 적용)

-- ───────── 1. 내 게임 기록 (계정별) ─────────
create table if not exists game_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null check (char_length(session_id) <= 64),
  game text not null check (char_length(game) <= 20),
  my_score integer not null default 0,
  opp_score integer not null default 0,
  opp_name text not null default '상대' check (char_length(opp_name) <= 10),
  outcome text not null check (outcome in ('win', 'lose', 'draw')),
  played_at timestamptz not null default now(),
  unique (user_id, session_id) -- 같은 판 중복 저장 방지
);
create index if not exists game_history_user_idx on game_history (user_id, played_at desc);
alter table game_history enable row level security;

drop policy if exists "own history read" on game_history;
create policy "own history read" on game_history for select to authenticated using (user_id = auth.uid());
drop policy if exists "own history insert" on game_history;
create policy "own history insert" on game_history for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own history delete" on game_history;
create policy "own history delete" on game_history for delete to authenticated using (user_id = auth.uid());

-- ───────── 2. 랭킹: 로그인했으면 계정 기준으로 기록 ─────────
alter table player_stats add column if not exists user_id uuid unique references auth.users(id) on delete cascade;

create or replace function record_game(p_device uuid, p_nickname text, p_avatar text, p_win boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_key uuid := coalesce(auth.uid(), p_device); -- 로그인: 계정 ID, 게스트: 기기 ID
  v_last timestamptz;
begin
  if v_key is null then return; end if;
  if p_nickname is null or char_length(trim(p_nickname)) not between 1 and 10 then return; end if;
  if p_avatar is null or char_length(p_avatar) > 20 then p_avatar := 'rabbit'; end if;
  select updated_at into v_last from player_stats where device_id = v_key;
  if v_last is not null and v_last > now() - interval '20 seconds' then return; end if;
  insert into player_stats (device_id, user_id, nickname, avatar, wins, games, updated_at)
  values (v_key, v_uid, trim(p_nickname), p_avatar, case when p_win then 1 else 0 end, 1, now())
  on conflict (device_id) do update set
    nickname = excluded.nickname, avatar = excluded.avatar,
    wins = player_stats.wins + case when p_win then 1 else 0 end,
    games = player_stats.games + 1, updated_at = now();
end $$;

-- ───────── 3. 게스트 기록 → 계정으로 합치기 ─────────
-- 로그인한 사용자가 자기 기기 ID의 랭킹 기록을 계정으로 옮김 (한 번 옮기면 기기 기록은 삭제)
create or replace function merge_guest(p_device uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); g record;
begin
  if v_uid is null or p_device is null or p_device = v_uid then return; end if;
  select * into g from player_stats where device_id = p_device and user_id is null;
  if not found then return; end if;
  insert into player_stats (device_id, user_id, nickname, avatar, wins, games, updated_at)
  values (v_uid, v_uid, g.nickname, g.avatar, g.wins, g.games, now())
  on conflict (device_id) do update set
    wins = player_stats.wins + g.wins, games = player_stats.games + g.games, updated_at = now();
  delete from player_stats where device_id = p_device and user_id is null;
end $$;

-- ───────── 4. 회원 탈퇴: 계정 삭제 → 프로필·기록·랭킹 함께 삭제 (cascade) ─────────
create or replace function delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  delete from public.player_stats where user_id = v_uid or device_id = v_uid;
  delete from auth.users where id = v_uid;
end $$;

revoke all on function merge_guest(uuid) from public, anon;
revoke all on function delete_my_account() from public, anon;
grant execute on function merge_guest(uuid) to authenticated;
grant execute on function delete_my_account() to authenticated;
grant execute on function record_game(uuid, text, text, boolean) to anon, authenticated;
