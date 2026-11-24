-- 한정판 아바타 해금 목록 (카카오 계정이면 다른 기기에서도 유지)
alter table profiles add column if not exists unlocked text[] not null default '{}';

alter table profiles drop constraint if exists profiles_unlocked_check;
alter table profiles add constraint profiles_unlocked_check
  check (unlocked <@ array['unicorn', 'wizard']::text[]);
