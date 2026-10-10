-- Migration: Team plans (multi-seat) + extra seats + marketing compare-at prices
-- Safe to run after migration-plans.sql. Run once in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1) plans: seat capacity, per-seat add-on price, strike-through "was" price
-- ---------------------------------------------------------------------------
alter table public.plans add column if not exists seats integer not null default 1;
alter table public.plans add column if not exists price_per_seat_inr integer not null default 0;
alter table public.plans add column if not exists price_per_seat_usd integer not null default 0;
alter table public.plans add column if not exists compare_at_inr integer;
alter table public.plans add column if not exists compare_at_usd integer;

-- ---------------------------------------------------------------------------
-- 2) licenses: seat pool on a single key
-- ---------------------------------------------------------------------------
alter table public.licenses add column if not exists seats integer not null default 1;
alter table public.licenses add column if not exists seats_used integer not null default 0;

-- ---------------------------------------------------------------------------
-- 3) orders: persist seat math (webhook never reads Razorpay notes)
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists extra_seats integer not null default 0;
alter table public.orders add column if not exists seats_purchased integer not null default 1;
alter table public.orders add column if not exists kind text not null default 'plan';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_kind_check'
  ) then
    alter table public.orders
      add constraint orders_kind_check check (kind in ('plan', 'seat_addon'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Device registry for team activations
-- ---------------------------------------------------------------------------
create table if not exists public.license_devices (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses (id) on delete cascade,
  device_id text not null,
  label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (license_id, device_id)
);

create index if not exists license_devices_license_id_idx on public.license_devices (license_id);

alter table public.license_devices enable row level security;
-- No public policies: seat writes/reads go through SECURITY DEFINER RPCs
-- (app, signed-in user) or the service role (site Account API).

-- ---------------------------------------------------------------------------
-- 5) Coupons: drop hard plan-id allowlist so team plan ids can be used
-- ---------------------------------------------------------------------------
alter table public.coupons drop constraint if exists coupons_plan_id_check;

-- ---------------------------------------------------------------------------
-- 6) Seat RPCs (callable from the desktop app with a signed-in user session)
-- ---------------------------------------------------------------------------

-- Claim (or refresh) a seat for this device on a team license.
create or replace function public.claim_seat(
  p_license_key text,
  p_device_id text,
  p_label text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.licenses%rowtype;
  v_count integer;
begin
  select * into v_license
  from public.licenses
  where license_key = upper(trim(p_license_key))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_license.user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if v_license.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  if v_license.expires_at is not null and v_license.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if coalesce(v_license.seats, 1) <= 1 then
    return jsonb_build_object('ok', false, 'code', 'not_team');
  end if;

  insert into public.license_devices (license_id, device_id, label, last_seen_at)
  values (v_license.id, p_device_id, nullif(p_label, ''), now())
  on conflict (license_id, device_id)
  do update set
    last_seen_at = now(),
    label = coalesce(excluded.label, license_devices.label);

  select count(*) into v_count
  from public.license_devices
  where license_id = v_license.id;

  if v_count > v_license.seats then
    delete from public.license_devices
    where license_id = v_license.id and device_id = p_device_id;
    select count(*) into v_count
    from public.license_devices
    where license_id = v_license.id;
    return jsonb_build_object(
      'ok', false, 'code', 'seats_full',
      'seats', v_license.seats, 'seats_used', v_count
    );
  end if;

  update public.licenses set seats_used = v_count where id = v_license.id;

  return jsonb_build_object(
    'ok', true,
    'seats', v_license.seats,
    'seats_used', v_count,
    'type', v_license.type,
    'expires_at', v_license.expires_at,
    'status', v_license.status
  );
end;
$$;

-- Release this device's seat (deactivate on a machine).
create or replace function public.release_seat(
  p_license_key text,
  p_device_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.licenses%rowtype;
  v_count integer;
begin
  select * into v_license
  from public.licenses
  where license_key = upper(trim(p_license_key));

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_license.user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  delete from public.license_devices
  where license_id = v_license.id and device_id = p_device_id;

  select count(*) into v_count
  from public.license_devices
  where license_id = v_license.id;

  update public.licenses set seats_used = v_count where id = v_license.id;

  return jsonb_build_object('ok', true, 'seats', v_license.seats, 'seats_used', v_count);
end;
$$;

-- Heartbeat: bump last_seen_at for this device (required every launch for team).
create or replace function public.touch_seat(
  p_license_key text,
  p_device_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.licenses%rowtype;
  v_updated boolean := false;
begin
  select * into v_license
  from public.licenses
  where license_key = upper(trim(p_license_key));

  if not found or v_license.user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  update public.license_devices
  set last_seen_at = now()
  where license_id = v_license.id and device_id = p_device_id;

  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'ok', true,
    'registered', v_updated,
    'seats', v_license.seats,
    'seats_used', coalesce(v_license.seats_used, 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Seed / update the six plans (idempotent upsert)
-- ---------------------------------------------------------------------------
insert into public.plans (
  id, name, blurb, license_type, months,
  price_inr, price_usd, active, sort_order, highlight,
  seats, price_per_seat_inr, price_per_seat_usd, compare_at_inr, compare_at_usd
) values
  (
    'monthly', 'Monthly',
    'Full access, cancel anytime. Billed every month.',
    'subscription', 1,
    15900, 200, true, 1, false,
    1, 0, 0, 19900, 250
  ),
  (
    'yearly', 'Yearly',
    'Full access for a year — two months free vs monthly.',
    'subscription', 12,
    159900, 1400, true, 2, true,
    1, 0, 0, 239900, 1900
  ),
  (
    'lifetime', 'Lifetime',
    'One payment, yours forever. All future updates included.',
    'perpetual', null,
    999900, 4900, true, 3, false,
    1, 0, 0, 1599900, 6900
  ),
  (
    'team-5', 'Team 5',
    'For small crews — full access on up to 5 computers. Billed monthly.',
    'subscription', 1,
    69900, 900, true, 4, false,
    5, 29900, 500, 99900, 1200
  ),
  (
    'team-8', 'Team 8',
    'Growing studios — full access on up to 8 computers. Billed monthly.',
    'subscription', 1,
    199900, 2400, true, 5, true,
    8, 29900, 500, 299900, 3200
  ),
  (
    'team-10', 'Team 10',
    'Full studio seat — up to 10 computers for a year.',
    'subscription', 12,
    1799900, 19900, true, 6, false,
    10, 29900, 500, 3599900, 39900
  )
on conflict (id) do update set
  name = excluded.name,
  blurb = excluded.blurb,
  license_type = excluded.license_type,
  months = excluded.months,
  price_inr = excluded.price_inr,
  price_usd = excluded.price_usd,
  active = excluded.active,
  sort_order = excluded.sort_order,
  highlight = excluded.highlight,
  seats = excluded.seats,
  price_per_seat_inr = excluded.price_per_seat_inr,
  price_per_seat_usd = excluded.price_per_seat_usd,
  compare_at_inr = excluded.compare_at_inr,
  compare_at_usd = excluded.compare_at_usd;

-- Backfill: existing individual licenses keep seats=1 (column default).
update public.licenses set seats = 1 where seats is null or seats < 1;
