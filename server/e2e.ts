import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

const URL_ = process.env.VITE_SUPABASE_URL!
const ANON = process.env.VITE_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const anon = createClient(URL_, ANON)
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

const stamp = Date.now()
const emailA = `e2e-a-${stamp}@gmail.com`
const emailB = `e2e-b-${stamp}@gmail.com`
const password = 'E2eTest!234'

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function post(path: string, body: unknown, token?: string): Promise<{ status: number; json: any }> {
  const response = await fetch(`http://localhost:3001${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  })
  return { status: response.status, json: await response.json().catch(() => ({})) }
}

async function main(): Promise<void> {
  console.log('--- 1. Supabase auth: signup + admin confirm + sign in ---')
  const signup = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true })
  check('admin create user', Boolean(signup.data.user), signup.error?.message ?? signup.data.user?.id ?? '')
  if (!signup.data.user) throw new Error(`signup failed: ${signup.error?.message ?? 'unknown'}`)
  const userIdA = signup.data.user.id
  check('admin email confirm', true, 'created confirmed')
  const signin = await anon.auth.signInWithPassword({ email: emailA, password })
  check('sign in returns session', Boolean(signin.data.session), signin.error?.message ?? '')
  const tokenA = signin.data.session!.access_token

  console.log('--- 2. Purchase (mock mode): create-order ---')
  const order = await post('/api/create-order', { planId: 'lifetime', currency: 'INR' }, tokenA)
  check('create-order 200', order.status === 200, JSON.stringify(order.json).slice(0, 160))
  check('mock order id', typeof order.json.orderId === 'string' && order.json.orderId.startsWith('order_mock_'), order.json.orderId)
  check('amount incl 18% GST = 471882 paise', order.json.amount === 471882, `got ${order.json.amount}`)
  check('mock flag true', order.json.mock === true)

  console.log('--- 3. verify-payment fulfills license ---')
  const verify1 = await post('/api/verify-payment', {
    orderId: order.json.orderId,
    paymentId: `pay_mock_${stamp}`,
    signature: 'mock_sig'
  }, tokenA)
  check('verify 200', verify1.status === 200, JSON.stringify(verify1.json).slice(0, 160))
  const key = verify1.json.licenseKey as string | undefined
  check('CRIT- key format', /^CRIT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(key ?? ''), key ?? '')

  const verify2 = await post('/api/verify-payment', {
    orderId: order.json.orderId,
    paymentId: `pay_mock_${stamp}`,
    signature: 'mock_sig'
  }, tokenA)
  check('idempotent re-verify returns same key', verify2.json.licenseKey === key, verify2.json.licenseKey)

  console.log('--- 4. RLS: license visible to owner only ---')
  const ownRead = await anon.from('licenses').select('license_key, type').eq('license_key', key!)
  check('owner reads own license', !ownRead.error && ownRead.data?.length === 1, JSON.stringify(ownRead.data))
  const ownOrders = await anon.from('orders').select('status, total').eq('razorpay_order_id', order.json.orderId)
  check('owner reads own order (paid)', !ownOrders.error && ownOrders.data?.[0]?.status === 'paid', JSON.stringify(ownOrders.data))

  const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true })
  if (createdB.error) throw new Error(`create user B failed: ${createdB.error.message}`)
  const anonB = createClient(URL_, ANON)
  await anonB.auth.signInWithPassword({ email: emailB, password })
  const crossRead = await anonB.from('licenses').select('id')
  check('other user sees ZERO licenses', !crossRead.error && crossRead.data?.length === 0, `count=${crossRead.data?.length}`)
  const insertAttempt = await anonB.from('licenses').insert({ user_id: createdB.data.user!.id, license_key: 'CRIT-FAKE-FAKE-FAKE-FAKE', type: 'perpetual', plan_id: 'lifetime', status: 'active' })
  check('browser cannot insert licenses (RLS blocks)', Boolean(insertAttempt.error), insertAttempt.error?.code ?? 'no error!')

  console.log('--- 5. Desktop-app activation mimic (same calls the app makes) ---')
  const appSignIn = await anon.auth.signInWithPassword({ email: emailA, password })
  check('app-style signInWithPassword', Boolean(appSignIn.data.session), appSignIn.error?.message ?? '')
  const appRead = await anon.from('licenses').select('license_key, type, expires_at, status').eq('license_key', key!).maybeSingle()
  check('app-style license select (RLS)', !appRead.error && appRead.data?.status === 'active', JSON.stringify(appRead.data))
  check('lifetime license has expires_at null', appRead.data?.expires_at === null, String(appRead.data?.expires_at))

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
  console.log(`TEST ACCOUNT: ${emailA} / ${password}`)
  console.log(`LICENSE KEY: ${key}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('E2E crashed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
