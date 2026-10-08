import {
  getHeader,
  HttpError,
  readJsonBody,
  requirePost,
  type HandlerRequest,
  type HandlerResponse
} from './_lib/http.js'
import { getUserFromToken, supabaseAdmin } from './_lib/supabase.js'
import { createRazorpayOrder, isMockPayments, razorpayKeyId } from './_lib/razorpay.js'
import { isPlanId, quote, type CurrencyCode } from '../src/shared/plans.js'
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
    if (!isPlanId(planId)) throw new HttpError(400, 'Unknown plan.')
    if (!currency) throw new HttpError(400, 'Currency must be INR or USD.')

    const price = quote(planId, currency as CurrencyCode)
    let orderId: string
    if (isMockPayments()) {
      orderId = `order_mock_${crypto.randomBytes(6).toString('hex')}`
    } else {
      orderId = await createRazorpayOrder({
        amount: price.total,
        currency,
        receipt: `cr_${Date.now()}`,
        notes: { userId: user.id, planId }
      })
    }

    const { error: insertError } = await supabaseAdmin().from('orders').insert({
      user_id: user.id,
      razorpay_order_id: orderId,
      plan_id: planId,
      currency,
      subtotal: price.subtotal,
      tax_percent: price.taxPercent,
      tax_amount: price.tax,
      total: price.total,
      status: 'created'
    })
    if (insertError) throw new Error(`Could not record the order: ${insertError.message}`)

    res.status(200).json({
      orderId,
      amount: price.total,
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
