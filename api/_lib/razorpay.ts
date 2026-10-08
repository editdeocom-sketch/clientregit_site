import crypto from 'node:crypto'
import { HttpError } from './http.js'

export function isMockPayments(): boolean {
  return process.env.MOCK_PAYMENTS === '1' || !process.env.RAZORPAY_KEY_ID
}

export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID || ''
}

function keySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET is not set.')
  return secret
}

export async function createRazorpayOrder(input: {
  amount: number
  currency: string
  receipt: string
  notes: Record<string, string>
}): Promise<string> {
  const auth = Buffer.from(`${razorpayKeyId()}:${keySecret()}`).toString('base64')
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes
    })
  })
  const payload = (await response.json()) as { id?: string; error?: { description?: string } }
  if (response.status === 401) {
    throw new HttpError(401, 'Payment gateway rejected the server credentials (RAZORPAY_KEY_ID/SECRET).')
  }
  if (!response.ok || !payload.id) {
    throw new HttpError(502, payload.error?.description || `Razorpay order failed (${response.status}).`)
  }
  return payload.id
}

function hmacHex(secret: string, message: string): string {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8')
  const bufferB = Buffer.from(b, 'utf8')
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB)
}

/** Checkout handshake: HMAC(order_id + '|' + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!signature) return false
  const expected = hmacHex(keySecret(), `${orderId}|${paymentId}`)
  return safeEqual(expected, signature.toLowerCase())
}

/** Webhook: HMAC-SHA256(raw body, webhook secret) vs x-razorpay-signature. */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqual(expected, signature.toLowerCase())
}
