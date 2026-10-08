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

export function createOrder(planId: PlanId, currency: CurrencyCode): Promise<CreateOrderResult> {
  return postJson<CreateOrderResult>('/api/create-order', { planId, currency })
}

export interface VerifyResult {
  licenseKey: string
}

export function verifyPayment(orderId: string, paymentId: string, signature: string): Promise<VerifyResult> {
  return postJson<VerifyResult>('/api/verify-payment', { orderId, paymentId, signature })
}
