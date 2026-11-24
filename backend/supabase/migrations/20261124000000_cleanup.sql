-- 오래된 데이터 자동 정리 (개인정보 처리방침의 보관 기간과 맞춤)
--  · 방·판 기록(rooms 및 딸린 room_players / game_sessions / game_state / game_events): 30일 뒤 삭제
--  · 방에 연결되지 않은 게스트 플레이어 기록(players): 30일 뒤 삭제
--  · 게스트 순위 기록(player_stats, 계정 없음): 1년 동안 게임을 안 하면 삭제
--  · 카카오 계정 기록(profiles, game_history)은 회원 탈퇴 때 함께 삭제되므로 여기서는 건드리지 않음

create or replace function public.cleanup_old_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from rooms where created_at < now() - interval '30 days';
  delete from players p
    where p.created_at < now() - interval '30 days'
      and not exists (select 1 from rooms r where r.host_id = p.id);
  delete from player_stats where user_id is null and updated_at < now() - interval '365 days';
$$;

-- 앱(브라우저)에서는 실행할 수 없게
revoke all on function public.cleanup_old_data() from public, anon, authenticated;

-- 매일 새벽 4시(UTC, 한국 시간 오후 1시)에 실행
create extension if not exists pg_cron;
select cron.schedule('momopang-cleanup', '0 4 * * *', $$ select public.cleanup_old_data(); $$);
