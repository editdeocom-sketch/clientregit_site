export interface HandlerRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  rawBody?: string | Buffer | undefined
  query?: Record<string, string | string[] | undefined>
}

export interface HandlerResponse {
  status(code: number): HandlerResponse
  json(body: unknown): unknown
  setHeader(name: string, value: string): unknown
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message)
  }
}

export function getHeader(req: HandlerRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

export async function readJsonBody(req: HandlerRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>
    } catch {
      throw new HttpError(400, 'Invalid JSON body.')
    }
  }
  const raw = req.rawBody
  if (raw) {
    try {
      return JSON.parse(raw.toString()) as Record<string, unknown>
    } catch {
      throw new HttpError(400, 'Invalid JSON body.')
    }
  }
  throw new HttpError(400, 'Missing request body.')
}

export function requirePost(req: HandlerRequest): void {
  if (req.method === 'OPTIONS') return
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
}
