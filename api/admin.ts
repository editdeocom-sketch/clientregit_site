import {
  getHeader,
  HttpError,
  readJsonBody,
  type HandlerRequest,
  type HandlerResponse
} from './_lib/http.js'
import { requireAdmin } from './_lib/admin.js'
import { supabaseAdmin } from './_lib/supabase.js'
import { isPlanId } from '../src/shared/plans.js'

function queryValue(req: HandlerRequest, key: string): string | undefined {
  const raw = req.query?.[key]
  return Array.isArray(raw) ? raw[0] : raw
}

async function listUsers(): Promise<{ users: unknown[] }> {
  const db = supabaseAdmin()
  const [{ data: profiles }, { data: licenses }, { data: orders }] = await Promise.all([
    db.from('profiles').select('id, email, is_admin, created_at').order('created_at', { ascending: false }),
    db.from('licenses').select('user_id'),
    db.from('orders').select('user_id')
  ])
  const licenseCounts = new Map<string, number>()
  for (const l of licenses ?? []) {
    const id = (l as { user_id: string }).user_id
    licenseCounts.set(id, (licenseCounts.get(id) ?? 0) + 1)
  }
  const orderCounts = new Map<string, number>()
  for (const o of orders ?? []) {
    const id = (o as { user_id: string }).user_id
    orderCounts.set(id, (orderCounts.get(id) ?? 0) + 1)
  }
  const users = (profiles ?? []).map((p) => ({
    ...(p as { id: string; email: string | null; is_admin: boolean; created_at: string }),
    license_count: licenseCounts.get((p as { id: string }).id) ?? 0,
    order_count: orderCounts.get((p as { id: string }).id) ?? 0
  }))
  return { users }
}

async function listLicenses(): Promise<{ licenses: unknown[] }> {
  const db = supabaseAdmin()
  const [{ data: licenses }, { data: profiles }] = await Promise.all([
    db.from('licenses').select('*').order('created_at', { ascending: false }),
    db.from('profiles').select('id, email')
  ])
  const emailById = new Map<string, string | null>()
  for (const p of profiles ?? []) {
    const row = p as { id: string; email: string | null }
    emailById.set(row.id, row.email)
  }
  return {
    licenses: (licenses ?? []).map((l) => ({
      ...(l as Record<string, unknown>),
      email: emailById.get((l as { user_id: string }).user_id) ?? null
    }))
  }
}

async function listOrders(): Promise<{ orders: unknown[] }> {
  const db = supabaseAdmin()
  const [{ data: orders }, { data: profiles }] = await Promise.all([
    db.from('orders').select('*').order('created_at', { ascending: false }),
    db.from('profiles').select('id, email')
  ])
  const emailById = new Map<string, string | null>()
  for (const p of profiles ?? []) {
    const row = p as { id: string; email: string | null }
    emailById.set(row.id, row.email)
  }
  return {
    orders: (orders ?? []).map((o) => ({
      ...(o as Record<string, unknown>),
      email: emailById.get((o as { user_id: string }).user_id) ?? null
    }))
  }
}

async function listCoupons(): Promise<{ coupons: unknown[] }> {
  const { data } = await supabaseAdmin()
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })
  return { coupons: data ?? [] }
}

async function setLicenseStatus(licenseId: string, status: string): Promise<void> {
  if (status !== 'active' && status !== 'revoked') throw new HttpError(400, 'Status must be active or revoked.')
  if (typeof licenseId !== 'string' || !licenseId) throw new HttpError(400, 'licenseId is required.')
  const { error } = await supabaseAdmin().from('licenses').update({ status }).eq('id', licenseId)
  if (error) throw new HttpError(500, `Could not update license: ${error.message}`)
}

async function createCoupon(body: Record<string, unknown>): Promise<void> {
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const type = body.type === 'percent' || body.type === 'fixed' ? body.type : null
  const value = typeof body.value === 'number' ? body.value : null
  const planId = typeof body.planId === 'string' && body.planId ? body.planId : null
  const maxUses = typeof body.maxUses === 'number' && body.maxUses > 0 ? Math.floor(body.maxUses) : null
  const expiresAt = typeof body.expiresAt === 'string' && body.expiresAt ? body.expiresAt : null

  if (!code) throw new HttpError(400, 'Coupon code is required.')
  if (!type) throw new HttpError(400, 'Type must be percent or fixed.')
  if (value === null || !Number.isFinite(value) || value <= 0) throw new HttpError(400, 'Value must be positive.')
  if (type === 'percent' && value > 100) throw new HttpError(400, 'Percent cannot exceed 100.')
  if (planId && !isPlanId(planId)) throw new HttpError(400, 'Unknown plan.')

  const { error } = await supabaseAdmin().from('coupons').insert({
    code,
    type,
    value: Math.round(value),
    plan_id: planId,
    max_uses: maxUses,
    expires_at: expiresAt
  })
  if (error) throw new HttpError(400, error.code === '23505' ? `Coupon ${code} already exists.` : error.message)
}

async function updateCoupon(body: Record<string, unknown>): Promise<void> {
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) throw new HttpError(400, 'id is required.')

  const patch: Record<string, unknown> = {}
  if (typeof body.code === 'string') {
    const code = body.code.trim().toUpperCase()
    if (!code) throw new HttpError(400, 'Code cannot be empty.')
    patch.code = code
  }
  if (body.type !== undefined) {
    if (body.type !== 'percent' && body.type !== 'fixed') throw new HttpError(400, 'Invalid type.')
    patch.type = body.type
  }
  if (body.value !== undefined) {
    if (typeof body.value !== 'number' || body.value <= 0) throw new HttpError(400, 'Value must be positive.')
    patch.value = Math.round(body.value)
  }
  if (body.planId !== undefined) {
    const planId = body.planId
    if (planId !== null && (typeof planId !== 'string' || !isPlanId(planId))) {
      throw new HttpError(400, 'Unknown plan.')
    }
    patch.plan_id = planId
  }
  if (body.maxUses !== undefined) {
    const maxUses = body.maxUses
    if (maxUses !== null && (typeof maxUses !== 'number' || maxUses <= 0)) {
      throw new HttpError(400, 'maxUses must be a positive number or null.')
    }
    patch.max_uses = maxUses
  }
  if (body.expiresAt !== undefined) {
    patch.expires_at = body.expiresAt
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'active must be boolean.')
    patch.active = body.active
  }
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update.')

  const { error } = await supabaseAdmin().from('coupons').update(patch).eq('id', id)
  if (error) throw new HttpError(400, error.code === '23505' ? 'That code is already in use.' : error.message)
}

async function deleteCoupon(id: string): Promise<void> {
  if (!id) throw new HttpError(400, 'id is required.')
  const { error } = await supabaseAdmin().from('coupons').delete().eq('id', id)
  if (error) throw new HttpError(500, `Could not delete coupon: ${error.message}`)
}

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  try {
    if (req.method === 'OPTIONS') {
      res.status(204).json({})
      return
    }
    await requireAdmin(req as never)

    if (req.method === 'GET') {
      const resource = queryValue(req, 'resource')
      if (resource === 'users') {
        res.status(200).json(await listUsers())
        return
      }
      if (resource === 'licenses') {
        res.status(200).json(await listLicenses())
        return
      }
      if (resource === 'orders') {
        res.status(200).json(await listOrders())
        return
      }
      if (resource === 'coupons') {
        res.status(200).json(await listCoupons())
        return
      }
      throw new HttpError(400, 'Unknown resource.')
    }

    const authorization = getHeader(req, 'authorization')
    if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in required.')

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const action = typeof body.action === 'string' ? body.action : ''
      switch (action) {
        case 'setLicenseStatus':
          await setLicenseStatus(
            typeof body.licenseId === 'string' ? body.licenseId : '',
            typeof body.status === 'string' ? body.status : ''
          )
          break
        case 'createCoupon':
          await createCoupon(body)
          break
        case 'updateCoupon':
          await updateCoupon(body)
          break
        case 'deleteCoupon':
          await deleteCoupon(typeof body.id === 'string' ? body.id : '')
          break
        default:
          throw new HttpError(400, 'Unknown action.')
      }
      res.status(200).json({ ok: true })
      return
    }

    throw new HttpError(405, 'Method not allowed.')
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    res.status(statusCode).json({ error: message })
  }
}
