import crypto from 'node:crypto'
import type { LicenseType } from '../../src/shared/plans.js'
import { supabaseAdmin } from './supabase.js'
import { fetchPlans, planSeats } from './plans.js'

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
 * Wins the order row with a conditional update, then inserts the license
 * (or grants extra seats onto an existing team key for seat_addon orders).
 */
export async function fulfillOrder(razorpayOrderId: string, paymentId: string): Promise<FulfillResult> {
  const db = supabaseAdmin()

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, user_id, plan_id, status, extra_seats, kind')
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
      const extraSeats = order.extra_seats ?? 0

      if (order.kind === 'seat_addon') {
        // Add-on: grow the seat cap on the user's existing active team key.
        const { data: existing, error: existingError } = await db
          .from('licenses')
          .select('id, license_key, seats')
          .eq('user_id', order.user_id)
          .eq('plan_id', plan.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (existingError) throw new Error(`License lookup failed: ${existingError.message}`)
        if (!existing) {
          throw new Error('No active Team license found for this seat add-on. Contact support.')
        }
        const currentSeats = existing.seats ?? 1
        const { error: seatError } = await db
          .from('licenses')
          .update({ seats: currentSeats + extraSeats })
          .eq('id', existing.id)
        if (seatError) throw new Error(`Could not add seats: ${seatError.message}`)
      } else {
        const type: LicenseType = plan.license_type
        const seats = planSeats(plan) + extraSeats
        const { error: insertError } = await db.from('licenses').insert({
          user_id: order.user_id,
          license_key: generateKey(),
          type,
          plan_id: plan.id,
          status: 'active',
          expires_at: plan.months ? subscriptionExpiry(plan.months) : null,
          order_id: order.id,
          seats,
          seats_used: 0
        })
        if (insertError && insertError.code !== '23500' && insertError.code !== '23505') {
          throw new Error(`License insert failed: ${insertError.message}`)
        }
      }
    }
  }

  if (order.extra_seats && order.extra_seats > 0 && order.kind === 'seat_addon') {
    const { data: license, error: licenseError } = await db
      .from('licenses')
      .select('license_key')
      .eq('user_id', order.user_id)
      .eq('plan_id', order.plan_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (licenseError) throw new Error(`License lookup failed: ${licenseError.message}`)
    if (!license) throw new Error('License was not found. Contact support with your payment id.')
    return { licenseKey: license.license_key as string }
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
