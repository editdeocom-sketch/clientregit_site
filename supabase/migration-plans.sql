-- Migration: Dynamic plans + hard-lock admin to the site owner
-- Safe to run multiple times.

-- 1. Plans table (public read, service-role writes only)
create table if not exists public.plans (
  id text primary key,
  name text not null,
  blurb text not null default '',
  license_type text not null check (license_type in ('perpetual', 'subscription')),
  months integer,
  price_inr integer not null,
  price_usd integer not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  highlight boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;
drop policy if exists "plans_public_read" on public.plans;
create policy "plans_public_read" on public.plans for select using (true);

insert into public.plans (id, name, blurb, license_type, months, price_inr, price_usd, sort_order, highlight) values
  ('monthly', 'Monthly', 'Full access, cancel anytime. Billed every month.', 'subscription', 1, 15900, 200, 1, false),
  ('yearly', 'Yearly', 'Full access for a year — two months free vs monthly.', 'subscription', 12, 109900, 1400, 2, true),
  ('lifetime', 'Lifetime', 'One payment, yours forever. All future updates included.', 'perpetual', null, 399900, 4900, 3, false)
on conflict (id) do nothing;

-- 2. Remove client self-insert on profiles (the signup trigger already creates rows)
drop policy if exists "profiles_insert_own" on public.profiles;

-- 3. Hard-lock: is_admin can only ever be true for the site owner
drop trigger if exists protect_admin_flag on public.profiles;
create or replace function public.enforce_admin_flag()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is true and new.email is distinct from 'yelagondalaxman@gmail.com' then
    raise exception 'Only the site owner can be an admin';
  end if;
  return new;
end;
$$;
create trigger protect_admin_flag
  before insert or update on public.profiles
  for each row execute function public.enforce_admin_flag();
