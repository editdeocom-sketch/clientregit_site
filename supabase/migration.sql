-- Migration: Admin features + Coupons + order discount columns
-- Safe to run multiple times (idempotent).

-- 1. Add is_admin to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('percent', 'fixed')),
  value integer NOT NULL,
  plan_id text CHECK (plan_id IN ('lifetime', 'monthly', 'yearly')),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add coupon columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0;

-- 4. Enable RLS on coupons (no public access — service role only)
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
