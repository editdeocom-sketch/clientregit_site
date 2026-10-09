import { HttpError } from './http.js'
import { supabaseAdmin } from './supabase.js'
import { GST_PERCENT, type CurrencyCode } from '../../src/shared/plans.js'

export interface DbPlan {
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
}

const CACHE_TTL_MS = 60_000
let cache: { rows: DbPlan[]; at: number } | null = null

export function invalidatePlanCache(): void {
  cache = null
}

export async function fetchPlans(): Promise<DbPlan[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows
  const { data, error } = await supabaseAdmin().from('plans').select('*')
  if (error) throw new Error(`Could not load plans: ${error.message}`)
  cache = { rows: (data ?? []) as DbPlan[], at: Date.now() }
  return cache.rows
}

export async function requireActivePlan(planId: string): Promise<DbPlan> {
  if (!planId) throw new HttpError(400, 'Unknown plan.')
  const plan = (await fetchPlans()).find((p) => p.id === planId)
  if (!plan || !plan.active) throw new HttpError(400, 'Unknown plan.')
  return plan
}

export function planSubtotal(plan: DbPlan, currency: CurrencyCode): number {
  return currency === 'INR' ? plan.price_inr : plan.price_usd
}

export function taxPercentFor(currency: CurrencyCode): number {
  return currency === 'INR' ? GST_PERCENT : 0
}
