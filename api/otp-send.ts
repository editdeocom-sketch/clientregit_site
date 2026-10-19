import { HttpError, readJsonBody, requirePost, type HandlerRequest, type HandlerResponse } from './_lib/http.js'
import { assertIpRate } from './_lib/ratelimit.js'
import {
  assertSendAllowed,
  discardUnconsumedCodes,
  generateCode,
  normalizeEmail,
  sendOtpEmail,
  storeCode
} from './_lib/otp.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  try {
    requirePost(req)
    if (req.method === 'OPTIONS') {
      res.status(204).json({})
      return
    }
    assertIpRate(req, 'otp-send', 10)
    const body = await readJsonBody(req)
    const email = normalizeEmail(typeof body.email === 'string' ? body.email : '')
    await assertSendAllowed(email)
    const code = generateCode()
    await storeCode(email, code)
    try {
      await sendOtpEmail(email, code)
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
