import crypto from 'node:crypto'
import { HttpError } from './http.js'
import { supabaseAdmin } from './supabase.js'

export { sendOtpEmail } from './mail.js'

const CODE_TTL_MINUTES = 10
const MIN_RESEND_SECONDS = 60
const MAX_SENDS_PER_HOUR = 5
const MAX_VERIFY_ATTEMPTS = 5

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  return email
}

export function generateCode(): string {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0')
}

function hashCode(email: string, code: string): string {
  return crypto.createHash('sha256').update(`${email}:${code}`).digest('hex')
}

export async function assertSendAllowed(email: string): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin()
    .from('email_otps')
    .select('created_at')
    .eq('email', email)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  if (error) throw new HttpError(500, 'Could not check send limits.')
  const rows = data ?? []
  if (rows.length >= MAX_SENDS_PER_HOUR) {
    throw new HttpError(429, 'Too many code requests for this email — try again later.')
  }
  if (rows.length > 0) {
    const wait = MIN_RESEND_SECONDS - Math.floor((Date.now() - new Date(rows[0].created_at).getTime()) / 1000)
    if (wait > 0) throw new HttpError(429, `Please wait ${wait} seconds before requesting another code.`)
  }
}

export async function storeCode(email: string, code: string): Promise<void> {
  await supabaseAdmin().from('email_otps').delete().eq('email', email).is('consumed_at', null)
  const { error } = await supabaseAdmin().from('email_otps').insert({
    email,
    code_hash: hashCode(email, code),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString()
  })
  if (error) throw new HttpError(500, 'Could not store the verification code.')
}

export async function discardUnconsumedCodes(email: string): Promise<void> {
  await supabaseAdmin().from('email_otps').delete().eq('email', email).is('consumed_at', null)
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from('email_otps')
    .select('id, code_hash, attempts, expires_at')
    .eq('email', email)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new HttpError(500, 'Could not verify the code.')
  if (!data) throw new HttpError(400, 'Code expired or not found — request a new one.')

  if (data.attempts >= MAX_VERIFY_ATTEMPTS) {
    await discardUnconsumedCodes(email)
    throw new HttpError(400, 'Too many wrong attempts — request a new code.')
  }

  const match = crypto.timingSafeEqual(Buffer.from(data.code_hash, 'hex'), Buffer.from(hashCode(email, code), 'hex'))
  if (!match) {
    const attempts = data.attempts + 1
    await supabaseAdmin().from('email_otps').update({ attempts }).eq('id', data.id)
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      await discardUnconsumedCodes(email)
      throw new HttpError(400, 'Too many wrong attempts — request a new code.')
    }
    throw new HttpError(400, `Incorrect code — ${MAX_VERIFY_ATTEMPTS - attempts} attempts left.`)
  }

  await supabaseAdmin()
    .from('email_otps')
    .update({ consumed_at: new Date().toISOString(), attempts: data.attempts + 1 })
    .eq('id', data.id)
}

export async function markEmailVerified(email: string): Promise<void> {
  await supabaseAdmin()
    .from('profiles')
    .update({ email_otp_verified_at: new Date().toISOString() })
    .ilike('email', email)

  const { data: users } = await supabaseAdmin().auth.admin.listUsers({ perPage: 1000 })
  const user = (users?.users ?? []).find((u) => u.email?.toLowerCase() === email)
  if (user && !user.email_confirmed_at) {
    await supabaseAdmin().auth.admin.updateUserById(user.id, { email_confirm: true })
  }
}
