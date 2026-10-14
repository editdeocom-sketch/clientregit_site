import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import { HttpError } from './http.js'
import { supabaseAdmin } from './supabase.js'

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

function emailHtml(code: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f3ef;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:460px;margin:32px auto;background:#ffffff;border-radius:16px;border:1px solid #e7e5de;overflow:hidden;">
      <div style="background:#14161c;padding:22px 32px;">
        <span style="color:#d4af37;font-size:18px;font-weight:bold;letter-spacing:0.5px;">ClientRegit</span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 6px;font-size:20px;color:#14161c;">Verify your email</h1>
        <p style="margin:0;color:#6b7280;font-size:14px;">Enter this code to finish creating your account:</p>
        <div style="margin:26px 0;text-align:center;">
          <span style="display:inline-block;font-family:monospace;font-size:34px;letter-spacing:10px;font-weight:bold;color:#14161c;background:#faf9f5;border:1px dashed #d4af37;border-radius:12px;padding:16px 10px 16px 20px;">${code}</span>
        </div>
        <p style="margin:0;color:#9ca3af;font-size:12px;">This code expires in ${CODE_TTL_MINUTES} minutes. If you didn&rsquo;t request it, you can safely ignore this email.</p>
      </div>
    </div>
  </body>
</html>`
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) {
    throw new HttpError(500, 'Email service is not configured yet — set SMTP_HOST, SMTP_USER and SMTP_PASS.')
  }
  const port = Number(process.env.SMTP_PORT ?? 465)
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  })
  try {
    await transporter.sendMail({
      from: `"ClientRegit" <${process.env.SMTP_FROM || user}>`,
      to: email,
      subject: `${code} is your ClientRegit verification code`,
      text: `Your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you didn't sign up for ClientRegit, ignore this email.`,
      html: emailHtml(code)
    })
  } catch (error) {
    console.error('[otp] send failed:', error instanceof Error ? error.message : error)
    throw new HttpError(502, 'Could not send the email — check the SMTP settings.')
  }
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
