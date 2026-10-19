import { HttpError, getHeader, type HandlerRequest } from './http.js'

// In-memory sliding-window limiter. Each serverless instance keeps its own map,
// so this is best-effort per-instance IP throttling layered on top of the
// per-email limits in otp.ts and Supabase's own auth rate limits — enough to
// stop scripted abuse of our endpoints (SMTP cost, enumeration, code guessing)
// without adding an external store.
const hits = new Map<string, number[]>()

const MAX_KEYS = 10000
const HOUR_MS = 60 * 60 * 1000

export function clientIp(req: HandlerRequest): string {
  const forwarded = getHeader(req, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return getHeader(req, 'x-real-ip') ?? 'unknown'
}

export function assertIpRate(req: HandlerRequest, bucket: string, limit: number, windowMs = HOUR_MS): void {
  const now = Date.now()
  const key = `${bucket}:${clientIp(req)}`
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    const waitSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000))
    throw new HttpError(429, `Too many requests from this network — try again in ${waitSec} seconds.`)
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > MAX_KEYS) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k)
      if (hits.size <= MAX_KEYS / 2) break
    }
  }
}
