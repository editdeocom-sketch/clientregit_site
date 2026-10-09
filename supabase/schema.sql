-- ClientRegit licensing schema — run this in Supabase SQL Editor.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  razorpay_order_id text not null unique,
  payment_id text,
  plan_id text not null,
  currency text not null check (currency in ('INR', 'USD')),
  subtotal integer not null,
  tax_percent integer not null default 0,
  tax_amount integer not null default 0,
  discount_amount integer not null default 0,
  coupon_code text,
  total integer not null,
  status text not null default 'created' check (status in ('created', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  license_key text not null unique,
  type text not null check (type in ('perpetual', 'subscription')),
  plan_id text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  order_id uuid unique references public.orders (id),
  created_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent', 'fixed')),
  value integer not null,
  plan_id text check (plan_id in ('lifetime', 'monthly', 'yearly')),
  max_uses integer,
  used_count integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id);
create index licenses_user_id_idx on public.licenses (user_id);

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: clients can only READ their own rows.
-- Inserts/updates happen exclusively via the service role (server), which
-- bypasses RLS — so keys and orders can never be created from the browser.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.licenses enable row level security;
alter table public.coupons enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

create policy "licenses_select_own" on public.licenses
  for select using (auth.uid() = user_id);

-- Coupons: no public policies — only service role (admin API) can access.
