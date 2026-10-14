import { HttpError, readJsonBody, requirePost, type HandlerRequest, type HandlerResponse } from './_lib/http.js'
import { markEmailVerified, normalizeEmail, verifyCode } from './_lib/otp.js'
import { sendWelcomeEmail } from './_lib/mail.js'
import { supabaseAdmin } from './_lib/supabase.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  try {
    requirePost(req)
    if (req.method === 'OPTIONS') {
      res.status(204).json({})
      return
    }
    const body = await readJsonBody(req)
    const email = normalizeEmail(typeof body.email === 'string' ? body.email : '')
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code.')
    await verifyCode(email, code)
    await markEmailVerified(email)
    try {
      const { data: profile } = await supabaseAdmin()
        .from('profiles')
        .select('full_name')
        .ilike('email', email)
        .maybeSingle()
      await sendWelcomeEmail(email, profile?.full_name ?? '')
    } catch (error) {
      console.error('[otp-verify] welcome email failed:', error instanceof Error ? error.message : error)
    }
    res.status(200).json({ ok: true })
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    res.status(statusCode).json({ error: message })
  }
}
