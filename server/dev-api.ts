import http from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { HandlerRequest, HandlerResponse } from '../api/_lib/http'

// Load .env before importing handlers (they read process.env lazily, but be safe).
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

const { default: createOrder } = await import('../api/create-order')
const { default: verifyPayment } = await import('../api/verify-payment')
const { default: razorpayWebhook } = await import('../api/razorpay-webhook')

type Handler = (req: HandlerRequest, res: HandlerResponse) => Promise<void>

const routes: Record<string, Handler> = {
  '/api/create-order': createOrder,
  '/api/verify-payment': verifyPayment,
  '/api/razorpay-webhook': razorpayWebhook
}

const server = http.createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    const raw = Buffer.concat(chunks)
    const url = new URL(req.url ?? '/', 'http://localhost')
    const handler = routes[url.pathname]

    const respond = (status: number, payload: unknown): void => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(payload))
    }

    if (!handler) {
      respond(404, { error: 'Not found.' })
      return
    }

    const headerObject: Record<string, string | string[] | undefined> = {}
    for (const [key, value] of Object.entries(req.headers)) headerObject[key.toLowerCase()] = value

    let body: unknown
    const contentType = req.headers['content-type'] ?? ''
    if (raw.length > 0 && contentType.includes('application/json')) {
      try {
        body = JSON.parse(raw.toString())
      } catch {
        body = raw.toString()
      }
    }

    const handlerRequest: HandlerRequest = {
      method: req.method,
      headers: headerObject,
      body,
      rawBody: raw,
      query: Object.fromEntries(url.searchParams.entries())
    }

    const handlerResponse: HandlerResponse = {
      status(code: number) {
        res.statusCode = code
        return handlerResponse
      },
      json(payload: unknown) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
      },
      setHeader(name: string, value: string) {
        res.setHeader(name, value)
      }
    }

    handler(handlerRequest, handlerResponse)
      .catch((error: unknown) => {
        console.error('[dev-api] handler error:', error)
        if (!res.writableEnded) respond(500, { error: 'Internal server error.' })
      })
      .finally(() => {
        if (!res.headersSent && !res.writableEnded) respond(500, { error: 'No response.' })
      })
  })
})

server.listen(3001, () => {
  console.log('[dev-api] listening on http://localhost:3001')
  if (!process.env.RAZORPAY_KEY_ID) {
    console.log('[dev-api] MOCK payments mode (no RAZORPAY_KEY_ID set)')
  }
})
