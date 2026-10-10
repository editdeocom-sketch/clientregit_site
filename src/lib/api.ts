import { supabase } from './supabase'
import type { CurrencyCode, PlanId } from '@shared/plans'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('You need to sign in first.')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function postJson<T>(path: string, body: unknown, withAuth = true): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: withAuth ? await authHeaders() : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload as T
}

export interface CreateOrderResult {
  orderId: string
  amount: number
  currency: CurrencyCode
  keyId: string
  mock: boolean
}

export function createOrder(
  planId: PlanId,
  currency: CurrencyCode,
  couponCode?: string,
  options?: { extraSeats?: number; mode?: 'plan' | 'seat_addon' }
): Promise<CreateOrderResult> {
  return postJson<CreateOrderResult>('/api/create-order', {
    planId,
    currency,
    couponCode,
    extraSeats: options?.extraSeats ?? 0,
    mode: options?.mode ?? 'plan'
  })
}

export interface VerifyResult {
  licenseKey: string
}

export function verifyPayment(orderId: string, paymentId: string, signature: string): Promise<VerifyResult> {
  return postJson<VerifyResult>('/api/verify-payment', { orderId, paymentId, signature })
}

export interface CouponValidation {
  valid: boolean
  code: string
  type: 'percent' | 'fixed'
  value: number
  discountAmount: number
}

export function validateCoupon(
  couponCode: string,
  planId: PlanId,
  currency: CurrencyCode
): Promise<CouponValidation> {
  return postJson<CouponValidation>('/api/validate-coupon', { couponCode, planId, currency })
}

export interface LicenseSeatDevice {
  device_id: string
  label: string | null
  last_seen_at: string
}

export interface LicenseSeatInfo {
  licenseId: string
  licenseKey: string
  planId: string
  status: string
  expiresAt: string | null
  seats: number
  seatsUsed: number
  devices: LicenseSeatDevice[]
}

export async function fetchLicenseSeats(): Promise<LicenseSeatInfo[]> {
  const headers = await authHeaders()
  const response = await fetch('/api/license-seats', { headers })
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    seats?: LicenseSeatInfo[]
  }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload.seats ?? []
}

// ---------------------------------------------------------------------------
// Admin API helpers
// ---------------------------------------------------------------------------

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders()
  const response = await fetch(path, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) }
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload as T
}

function adminPost<T>(body: unknown): Promise<T> {
  return adminFetch<T>('/api/admin', { method: 'POST', body: JSON.stringify(body) })
}

export interface AdminUserRow {
  id: string
  email: string | null
  is_admin: boolean
  created_at: string
  license_count: number
  order_count: number
}

export interface AdminLicenseRow {
  id: string
  user_id: string
  email: string | null
  license_key: string
  type: string
  plan_id: string
  status: 'active' | 'revoked'
  expires_at: string | null
  created_at: string
}

export interface AdminOrderRow {
  id: string
  user_id: string
  email: string | null
  plan_id: string
  currency: CurrencyCode
  subtotal: number
  tax_percent: number
  tax_amount: number
  discount_amount: number
  coupon_code: string | null
  total: number
  status: string
  created_at: string
  paid_at: string | null
}

export interface AdminCouponRow {
  id: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  plan_id: string | null
  max_uses: number | null
  used_count: number
  active: boolean
  expires_at: string | null
  created_at: string
}

export function adminUsers(): Promise<{ users: AdminUserRow[] }> {
  return adminFetch<{ users: AdminUserRow[] }>('/api/admin?resource=users')
}

export function adminLicenses(): Promise<{ licenses: AdminLicenseRow[] }> {
  return adminFetch<{ licenses: AdminLicenseRow[] }>('/api/admin?resource=licenses')
}

export function adminOrders(): Promise<{ orders: AdminOrderRow[] }> {
  return adminFetch<{ orders: AdminOrderRow[] }>('/api/admin?resource=orders')
}

export function adminCoupons(): Promise<{ coupons: AdminCouponRow[] }> {
  return adminFetch<{ coupons: AdminCouponRow[] }>('/api/admin?resource=coupons')
}

export function adminSetLicenseStatus(licenseId: string, status: 'active' | 'revoked'): Promise<{ ok: boolean }> {
  return adminPost<{ ok: boolean }>({ action: 'setLicenseStatus', licenseId, status })
}

export interface NewCoupon {
  code: string
  type: 'percent' | 'fixed'
  value: number
  planId: string | null
  maxUses: number | null
  expiresAt: string | null
}

export function adminCreateCoupon(coupon: NewCoupon): Promise<{ ok: boolean }> {
  return adminPost<{ ok: boolean }>({ action: 'createCoupon', ...coupon })
}

export function adminUpdateCoupon(
  id: string,
  patch: Partial<Pick<NewCoupon, 'code' | 'type' | 'value' | 'planId' | 'maxUses' | 'expiresAt'>> & { active?: boolean }
): Promise<{ ok: boolean }> {
  return adminPost<{ ok: boolean }>({ action: 'updateCoupon', id, ...patch })
}

export function adminDeleteCoupon(id: string): Promise<{ ok: boolean }> {
  return adminPost<{ ok: boolean }>({ action: 'deleteCoupon', id })
}

export interface AdminPlanRow {
  id: string
  name: string
  blurb: string
  license_type: 'perpetual' | 'subscription'
  months: number | null
  price_inr: number
  price_usd: number
  active: boolean
  sort_order: number
  highlight: boolean
  seats: number
  price_per_seat_inr: number
  price_per_seat_usd: number
  compare_at_inr: number | null
  compare_at_usd: number | null
  created_at: string
}

export function adminPlans(): Promise<{ plans: AdminPlanRow[] }> {
  return adminFetch<{ plans: AdminPlanRow[] }>('/api/admin?resource=plans')
}

export interface PlanPayload {
  id: string
  name: string
  blurb: string
  licenseType: 'perpetual' | 'subscription'
  months: number | null
  priceInr: number
  priceUsd: number
  active: boolean
  sortOrder: number
  highlight: boolean
  seats: number
  pricePerSeatInr: number
  pricePerSeatUsd: number
  compareAtInr: number | null
  compareAtUsd: number | null
}

export function adminCreatePlan(plan: PlanPayload): Promise<{ ok: boolean }> {
  return adminPost<{ ok: boolean }>({ action: 'createPlan', ...plan })
}

export function adminUpdatePlan(id: string, plan: Partial<PlanPayload>): Promise<{ ok: boolean }> {
  return adminPost<{ ok: boolean }>({ action: 'updatePlan', id, ...plan })
}

export function adminDeletePlan(id: string): Promise<{ ok: boolean }> {
  return adminPost<{ ok: boolean }>({ action: 'deletePlan', id })
}
