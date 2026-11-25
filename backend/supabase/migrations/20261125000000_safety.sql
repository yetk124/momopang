-- ───────── 랜덤 매칭 신고 · 차단 ─────────
-- match_id: 랜덤 매칭에서만 쓰는 브라우저별 공개 ID (기기 ID와 별개라 랭킹 기록과 연결되지 않아요)

-- 1) 신고: 직접 읽기/쓰기는 막고 report_player 함수로만 쌓여요. 대시보드 Table Editor에서 확인
create table if not exists reports (
  id bigint generated always as identity primary key,
  reporter_mid uuid not null,
  reporter_user uuid,                       -- 로그인(카카오/익명) 상태였다면 auth uid
  target_mid uuid not null,
  target_name text check (char_length(target_name) <= 10),
  reason text not null check (reason in ('abuse', 'sexual', 'privacy', 'grief', 'etc')),
  detail text check (char_length(detail) <= 200),
  game text check (char_length(game) <= 20),
  room_code text check (char_length(room_code) <= 12),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_target_idx on reports (target_mid, created_at desc);
create index if not exists reports_reporter_idx on reports (reporter_mid, created_at desc);
alter table reports enable row level security;   -- 정책 없음 = 클라이언트 접근 불가

-- 신고 1건 접수. 같은 사람이 같은 상대는 하루 1번, 하루 최대 10건
create or replace function report_player(
  p_reporter uuid, p_target uuid, p_name text, p_reason text, p_detail text, p_game text, p_room text
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_reporter is null or p_target is null or p_reporter = p_target then return false; end if;
  if p_reason not in ('abuse', 'sexual', 'privacy', 'grief', 'etc') then return false; end if;
  if exists (select 1 from reports where reporter_mid = p_reporter and target_mid = p_target and created_at > now() - interval '1 day') then return true; end if;
  if (select count(*) from reports where reporter_mid = p_reporter and created_at > now() - interval '1 day') >= 10 then return false; end if;
  insert into reports (reporter_mid, reporter_user, target_mid, target_name, reason, detail, game, room_code)
  values (p_reporter, auth.uid(), p_target, left(trim(p_name), 10), p_reason, nullif(left(trim(p_detail), 200), ''), left(p_game, 20), left(p_room, 12));
  return true;
end $$;
revoke all on function report_player(uuid, uuid, text, text, text, text, text) from public;
grant execute on function report_player(uuid, uuid, text, text, text, text, text) to anon, authenticated;

-- 24시간 안에 서로 다른 3명에게 신고받으면, 마지막 신고부터 24시간 동안 랜덤 매칭 제한
-- 반환: 제한이 풀리는 시각 (제한 없으면 null)
create or replace function match_restricted_until(p_mid uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select case when count(distinct reporter_mid) >= 3 then max(created_at) + interval '24 hours' end
  from reports
  where target_mid = p_mid and status <> 'dismissed' and created_at > now() - interval '24 hours';
$$;
revoke all on function match_restricted_until(uuid) from public;
grant execute on function match_restricted_until(uuid) to anon, authenticated;

-- 2) 차단: 카카오 로그인 사용자만 서버에 저장 (게스트는 폰에만 저장). 본인 것만 읽기/추가/삭제
create table if not exists blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_mid uuid not null,
  blocked_name text check (char_length(blocked_name) <= 10),
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_mid)
);
alter table blocks enable row level security;
drop policy if exists "own blocks read" on blocks;
create policy "own blocks read" on blocks for select to authenticated using (user_id = auth.uid());
drop policy if exists "own blocks insert" on blocks;
create policy "own blocks insert" on blocks for insert to authenticated
  with check (user_id = auth.uid() and (select count(*) from blocks b where b.user_id = auth.uid()) < 500);
drop policy if exists "own blocks delete" on blocks;
create policy "own blocks delete" on blocks for delete to authenticated using (user_id = auth.uid());

-- 3) 오래된 신고 정리: 처리된 신고는 1년 뒤 삭제 (기존 정리 함수에 추가)
create or replace function public.cleanup_old_data() returns void language sql security definer set search_path = public as $$
  delete from rooms where created_at < now() - interval '30 days';
  delete from players p where p.created_at < now() - interval '30 days' and not exists (select 1 from rooms r where r.host_id = p.id);
  delete from player_stats where user_id is null and updated_at < now() - interval '365 days';
  delete from reports where status <> 'open' and created_at < now() - interval '365 days';
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;
