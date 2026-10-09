import crypto from 'node:crypto'
import type { LicenseType } from '../../src/shared/plans.js'
import { supabaseAdmin } from './supabase.js'
import { fetchPlans } from './plans.js'

function generateKey(): string {
  const hex = crypto.randomBytes(8).toString('hex').toUpperCase()
  return `CRIT-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
}

function subscriptionExpiry(months: number): string {
  const date = new Date()
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString()
}

export interface FulfillResult {
  licenseKey: string
}

/**
 * Idempotent: safe to call from both the verify endpoint and the webhook.
 * Wins the order row with a conditional update, then inserts the license.
 */
export async function fulfillOrder(razorpayOrderId: string, paymentId: string): Promise<FulfillResult> {
  const db = supabaseAdmin()

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, user_id, plan_id, status')
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle()
  if (orderError) throw new Error(`Order lookup failed: ${orderError.message}`)
  if (!order) throw new Error('Order not found.')

  if (order.status !== 'paid') {
    const { data: updated, error: updateError } = await db
      .from('orders')
      .update({ status: 'paid', payment_id: paymentId, paid_at: new Date().toISOString() })
      .eq('razorpay_order_id', razorpayOrderId)
      .eq('status', 'created')
      .select('id')
    if (updateError) throw new Error(`Order update failed: ${updateError.message}`)
    if ((updated ?? []).length > 0) {
      const plan = (await fetchPlans()).find((p) => p.id === order.plan_id)
      if (!plan) throw new Error(`Unknown plan: ${order.plan_id}`)
      const type: LicenseType = plan.license_type
      const { error: insertError } = await db.from('licenses').insert({
        user_id: order.user_id,
        license_key: generateKey(),
        type,
        plan_id: plan.id,
        status: 'active',
        expires_at: plan.months ? subscriptionExpiry(plan.months) : null,
        order_id: order.id
      })
      if (insertError && insertError.code !== '23505') {
        throw new Error(`License insert failed: ${insertError.message}`)
      }
    }
  }

  const { data: license, error: licenseError } = await db
    .from('licenses')
    .select('license_key')
    .eq('order_id', order.id)
    .maybeSingle()
  if (licenseError) throw new Error(`License lookup failed: ${licenseError.message}`)
  if (!license) throw new Error('License was not created. Contact support with your payment id.')
  return { licenseKey: license.license_key as string }
}
