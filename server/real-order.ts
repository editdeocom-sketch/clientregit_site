import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

const anon = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function main(): Promise<void> {
  const signin = await anon.auth.signInWithPassword({
    email: 'e2e-a-1791446221559@gmail.com',
    password: 'E2eTest!234'
  })
  if (signin.error || !signin.data.session) throw new Error(signin.error?.message ?? 'sign in failed')

  const response = await fetch('http://localhost:3001/api/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signin.data.session.access_token}`
    },
    body: JSON.stringify({ planId: 'lifetime', currency: 'INR' })
  })
  const payload = (await response.json()) as { orderId?: string; amount?: number; keyId?: string; mock?: boolean }
  console.log('create-order ->', response.status, JSON.stringify(payload))

  if (response.status !== 200) process.exit(1)
  if (payload.mock) {
    console.log('FAIL: server still in mock mode (MOCK_PAYMENTS not applied)')
    process.exit(1)
  }

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
  const razorpay = await fetch(`https://api.razorpay.com/v1/orders/${payload.orderId}`, {
    headers: { Authorization: `Basic ${auth}` }
  })
  const order = (await razorpay.json()) as { id?: string; amount?: number; currency?: string; status?: string }
  console.log('razorpay order ->', razorpay.status, JSON.stringify({
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: order.status
  }))

  console.log('--- signature verification (real HMAC, as checkout modal would send) ---')
  const paymentId = `pay_test${Date.now()}`
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${payload.orderId}|${paymentId}`)
    .digest('hex')
  const verifyResponse = await fetch('http://localhost:3001/api/verify-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signin.data.session.access_token}`
    },
    body: JSON.stringify({ orderId: payload.orderId, paymentId, signature })
  })
  const verifyPayload = (await verifyResponse.json()) as { licenseKey?: string; error?: string }
  console.log('verify-payment ->', verifyResponse.status, JSON.stringify(verifyPayload))

  const badSignature = await fetch('http://localhost:3001/api/verify-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signin.data.session.access_token}`
    },
    body: JSON.stringify({ orderId: payload.orderId, paymentId, signature: 'f'.repeat(64) })
  }).then(async (r) => ({ status: r.status, body: await r.json() }))
  console.log('tampered signature ->', badSignature.status, JSON.stringify(badSignature.body))

  const ok =
    payload.keyId === process.env.RAZORPAY_KEY_ID &&
    payload.amount === 471882 &&
    String(payload.orderId).startsWith('order_') &&
    order.id === payload.orderId &&
    order.amount === 471882 &&
    order.currency === 'INR' &&
    verifyResponse.status === 200 &&
    /^CRIT-/.test(verifyPayload.licenseKey ?? '') &&
    badSignature.status === 400
  console.log(ok ? 'REAL ORDER TEST: PASS' : 'REAL ORDER TEST: FAIL')
  process.exit(ok ? 0 : 1)
}

main().catch((error) => {
  console.error('crashed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
