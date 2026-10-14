-- Migration: self-hosted email OTP (replaces Supabase email entirely)
-- Run in Supabase SQL Editor.

create table if not exists public.email_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_otps_email_idx
  on public.email_otps (lower(email), created_at desc);

-- No RLS policies on purpose: service-role only (never readable from the browser).
alter table public.email_otps enable row level security;

-- Flag showing the signup OTP was completed.
alter table public.profiles add column if not exists email_otp_verified_at timestamptz;
