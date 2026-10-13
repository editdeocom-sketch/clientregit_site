-- Migration: profile fields (full name + phone) on signup
-- Run in Supabase SQL Editor after schema.sql.

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;

-- Trigger now copies name/phone from signup metadata into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone;
  return new;
end;
$$;

-- Users can update their own profile row (name/phone edits from site).
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
