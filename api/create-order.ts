import {
  getHeader,
  HttpError,
  readJsonBody,
  requirePost,
  type HandlerRequest,
  type HandlerResponse
} from './_lib/http.js'
import { getUserFromToken, supabaseAdmin } from './_lib/supabase.js'
import { validateCouponFor } from './_lib/coupons.js'
import { planSeats, planSubtotalFor, requireActivePlan, taxPercentFor } from './_lib/plans.js'
import { createRazorpayOrder, isMockPayments, razorpayKeyId } from './_lib/razorpay.js'
import type { CurrencyCode } from '../src/shared/plans.js'
import crypto from 'node:crypto'

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  try {
    requirePost(req)
    if (req.method === 'OPTIONS') {
      res.status(204).json({})
      return
    }
    const authorization = getHeader(req, 'authorization')
    if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in required.')
    const user = await getUserFromToken(authorization.slice('Bearer '.length))

    const body = await readJsonBody(req)
    const planId = typeof body.planId === 'string' ? body.planId : ''
    const currency = body.currency === 'USD' ? 'USD' : body.currency === 'INR' ? 'INR' : null
    const couponCode = typeof body.couponCode === 'string' ? body.couponCode : ''
    if (!currency) throw new HttpError(400, 'Currency must be INR or USD.')

    const plan = await requireActivePlan(planId)
    const currencyCode = currency as CurrencyCode

    let extraSeats = 0
    let kind: 'plan' | 'seat_addon' = 'plan'
    if (body.extraSeats !== undefined && body.extraSeats !== null) {
      const n = body.extraSeats
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 50) {
        throw new HttpError(400, 'extraSeats must be an integer between 0 and 50.')
      }
      if (planSeats(plan) <= 1 && n > 0) {
        throw new HttpError(400, 'Extra members are only available on Team plans.')
      }
      extraSeats = n
    }
    if (body.mode === 'seat_addon') {
      if (planSeats(plan) <= 1) throw new HttpError(400, 'Extra members are only available on Team plans.')
      if (extraSeats < 1) throw new HttpError(400, 'Choose at least one extra member.')
      kind = 'seat_addon'
    }

    const seatsPurchased = planSeats(plan) + extraSeats
    const subtotal =
      kind === 'seat_addon'
        ? planSubtotalFor(plan, currencyCode, extraSeats) - planSubtotalFor(plan, currencyCode, 0)
        : planSubtotalFor(plan, currencyCode, extraSeats)
    const taxPercent = taxPercentFor(currencyCode)

    let discountAmount = 0
    let appliedCouponCode: string | null = null
    if (couponCode.trim()) {
      const { coupon, discountAmount: discount } = await validateCouponFor(couponCode, planId, subtotal)
      discountAmount = discount
      appliedCouponCode = coupon.code

      const claimed = await supabaseAdmin()
        .from('coupons')
        .update({ used_count: coupon.used_count + 1 })
        .eq('id', coupon.id)
        .eq('used_count', coupon.used_count)
        .eq('active', true)
      if (claimed.error || (claimed.data as unknown[] | null)?.length === 0) {
        throw new HttpError(409, 'This coupon was just used by someone else. Try again.')
      }
    }

    const discountedSubtotal = subtotal - discountAmount
    const tax = Math.round((discountedSubtotal * taxPercent) / 100)
    const total = discountedSubtotal + tax

    let orderId: string
    if (isMockPayments()) {
      orderId = `order_mock_${crypto.randomBytes(6).toString('hex')}`
    } else {
      orderId = await createRazorpayOrder({
        amount: total,
        currency,
        receipt: `cr_${Date.now()}`,
        notes: {
          userId: user.id,
          planId,
          extraSeats: String(extraSeats),
          mode: kind,
          ...(appliedCouponCode ? { coupon: appliedCouponCode } : {})
        }
      })
    }

    const { error: insertError } = await supabaseAdmin().from('orders').insert({
      user_id: user.id,
      razorpay_order_id: orderId,
      plan_id: planId,
      currency,
      subtotal,
      tax_percent: taxPercent,
      tax_amount: tax,
      discount_amount: discountAmount,
      coupon_code: appliedCouponCode,
      total,
      status: 'created',
      extra_seats: extraSeats,
      seats_purchased: seatsPurchased,
      kind
    })
    if (insertError) throw new Error(`Could not record the order: ${insertError.message}`)

    res.status(200).json({
      orderId,
      amount: total,
      currency,
      keyId: razorpayKeyId(),
      mock: isMockPayments()
    })
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    res.status(statusCode).json({ error: message })
  }
}
