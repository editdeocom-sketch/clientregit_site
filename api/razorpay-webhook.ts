import { getHeader, type HandlerRequest, type HandlerResponse } from './_lib/http.js'
import { fulfillOrder } from './_lib/fulfill.js'
import { verifyWebhookSignature } from './_lib/razorpay.js'

interface RazorpayEvent {
  event?: string
  payload?: {
    payment?: { entity?: { id?: string } }
    order?: { entity?: { id?: string } }
  }
}

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    // Not configured (e.g. local dev) â€” acknowledge without processing.
    res.status(200).json({ skipped: true })
    return
  }

  // Signature is over the exact raw bytes. Vercel parses JSON bodies, so fall
  // back to re-serializing (Razorpay sends minified JSON â€” matches byte-for-byte).
  const raw: string | Buffer =
    req.rawBody ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}))

  const signature = getHeader(req, 'x-razorpay-signature')
  if (!verifyWebhookSignature(raw, signature ?? '')) {
    res.status(401).json({ error: 'Invalid signature.' })
    return
  }

  let event: RazorpayEvent
  try {
    event = JSON.parse(raw.toString()) as RazorpayEvent
  } catch {
    res.status(400).json({ error: 'Invalid payload.' })
    return
  }

  if (event.event === 'order.paid') {
    const orderId = event.payload?.order?.entity?.id
    const paymentId = event.payload?.payment?.entity?.id
    if (orderId && paymentId) {
      try {
        await fulfillOrder(orderId, paymentId)
      } catch (error) {
        console.error('webhook fulfill failed:', error instanceof Error ? error.message : error)
        res.status(500).json({ error: 'Fulfillment failed.' })
        return
      }
    }
  }

  res.status(200).json({ received: true })
}
