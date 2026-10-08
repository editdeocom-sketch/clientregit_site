import {
  getHeader,
  HttpError,
  readJsonBody,
  requirePost,
  type HandlerRequest,
  type HandlerResponse
} from './_lib/http.js'
import { getUserFromToken, supabaseAdmin } from './_lib/supabase.js'
import { fulfillOrder } from './_lib/fulfill.js'
import { isMockPayments, verifyCheckoutSignature } from './_lib/razorpay.js'

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
    const orderId = typeof body.orderId === 'string' ? body.orderId : ''
    const paymentId = typeof body.paymentId === 'string' ? body.paymentId : ''
    const signature = typeof body.signature === 'string' ? body.signature : ''
    if (!orderId || !paymentId) throw new HttpError(400, 'Missing payment details.')

    const db = supabaseAdmin()
    const { data: order, error: orderError } = await db
      .from('orders')
      .select('id, user_id, status')
      .eq('razorpay_order_id', orderId)
      .maybeSingle()
    if (orderError) throw new Error(`Order lookup failed: ${orderError.message}`)
    if (!order) throw new HttpError(404, 'Order not found.')
    if (order.user_id !== user.id) throw new HttpError(403, 'This order belongs to another account.')

    if (isMockPayments()) {
      if (!paymentId.startsWith('pay_mock')) throw new HttpError(400, 'Mock payment id expected.')
    } else if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
      throw new HttpError(400, 'Payment signature verification failed.')
    }

    const result = await fulfillOrder(orderId, paymentId)
    res.status(200).json(result)
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    res.status(statusCode).json({ error: message })
  }
}
