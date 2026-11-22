-- 카카오 로그인 사용자 프로필 (Supabase Auth 계정과 1:1)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 10),
  avatar text not null default 'rabbit' check (char_length(avatar) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- 본인 프로필만 읽기·만들기·수정 (탈퇴 시 auth.users 삭제로 함께 삭제)
drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
