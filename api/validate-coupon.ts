import {
  HttpError,
  readJsonBody,
  requirePost,
  type HandlerRequest,
  type HandlerResponse
} from './_lib/http.js'
import { getUserFromToken } from './_lib/supabase.js'
import { validateCouponFor } from './_lib/coupons.js'
import { isPlanId, quote, type CurrencyCode } from '../src/shared/plans.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  try {
    requirePost(req)
    const authorization = req.headers.authorization
    const token = Array.isArray(authorization) ? authorization[0] : authorization
    if (!token?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in required.')
    await getUserFromToken(token.slice('Bearer '.length))

    const body = await readJsonBody(req)
    const couponCode = typeof body.couponCode === 'string' ? body.couponCode : ''
    const planId = typeof body.planId === 'string' ? body.planId : ''
    const currency = body.currency === 'USD' ? 'USD' : body.currency === 'INR' ? 'INR' : null
    if (!isPlanId(planId)) throw new HttpError(400, 'Unknown plan.')
    if (!currency) throw new HttpError(400, 'Currency must be INR or USD.')

    const price = quote(planId, currency as CurrencyCode)
    const { coupon, discountAmount } = await validateCouponFor(couponCode, planId, price.subtotal)

    res.status(200).json({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountAmount
    })
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    res.status(statusCode).json({ error: message })
  }
}
