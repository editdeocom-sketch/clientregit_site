import crypto from 'node:crypto'
import { HttpError, readJsonBody, requirePost, type HandlerRequest, type HandlerResponse } from './_lib/http.js'
import { supabaseAdmin } from './_lib/supabase.js'
import { assertSendAllowed, discardUnconsumedCodes, normalizeEmail } from './_lib/otp.js'
import { sendResetEmail } from './_lib/mail.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  try {
    requirePost(req)
    if (req.method === 'OPTIONS') {
      res.status(204).json({})
      return
    }
    const body = await readJsonBody(req)
    const email = normalizeEmail(typeof body.email === 'string' ? body.email : '')
    await assertSendAllowed(email)

    const origin = (process.env.SITE_URL || 'https://clientregit.com').replace(/\/+$/, '')
    let actionLink: string
    try {
      const { data, error } = await supabaseAdmin().auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${origin}/reset-password` }
      })
      if (error) throw error
      actionLink = data.properties.action_link
    } catch (error) {
      // Unknown email (or GoTrue refused): answer identically to avoid account enumeration.
      console.warn('[reset] generateLink failed:', error instanceof Error ? error.message : error)
      res.status(200).json({ ok: true })
      return
    }

    await discardUnconsumedCodes(email)
    const { error: storeError } = await supabaseAdmin().from('email_otps').insert({
      email,
      code_hash: crypto.createHash('sha256').update(`${email}:${actionLink}`).digest('hex'),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    })
    if (storeError) throw new HttpError(500, 'Could not process the reset request.')

    try {
      await sendResetEmail(email, actionLink)
    } catch (error) {
      await discardUnconsumedCodes(email)
      throw error
    }
    res.status(200).json({ ok: true })
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    res.status(statusCode).json({ error: message })
  }
}
