import {
  getHeader,
  HttpError,
  readJsonBody,
  type HandlerRequest,
  type HandlerResponse
} from './_lib/http.js'
import { requireAdmin } from './_lib/admin.js'
import { supabaseAdmin } from './_lib/supabase.js'
import { invalidatePlanCache } from './_lib/plans.js'

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

async function listPlans(): Promise<{ plans: unknown[] }> {
  const { data, error } = await supabaseAdmin().from('plans').select('*').order('sort_order')
  if (error) throw new HttpError(500, `Could not load plans: ${error.message}`)
  return { plans: data ?? [] }
}

const PLAN_ID_RE = /^[a-z0-9][a-z0-9-]{1,38}$/

function parsePlanFields(body: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (!partial || body.id !== undefined) {
    const id = typeof body.id === 'string' ? body.id.trim().toLowerCase() : ''
    if (!PLAN_ID_RE.test(id)) {
      throw new HttpError(400, 'Plan id must be 2-39 chars: lowercase letters, digits, hyphens.')
    }
    patch.id = id
  }
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) throw new HttpError(400, 'Plan name is required.')
    patch.name = name
  }
  if (body.blurb !== undefined) patch.blurb = typeof body.blurb === 'string' ? body.blurb.trim() : ''
  if (!partial || body.licenseType !== undefined) {
    const licenseType = body.licenseType
    if (licenseType !== 'perpetual' && licenseType !== 'subscription') {
      throw new HttpError(400, 'licenseType must be perpetual or subscription.')
    }
    patch.license_type = licenseType
  }
  if (body.months !== undefined) {
    const months = body.months
    if (months !== null && (typeof months !== 'number' || !Number.isInteger(months) || months < 1)) {
      throw new HttpError(400, 'months must be a positive integer or null.')
    }
    patch.months = months
  }
  for (const key of ['priceInr', 'priceUsd'] as const) {
    const column = key === 'priceInr' ? 'price_inr' : 'price_usd'
    if (!partial || body[key] !== undefined) {
      const value = body[key]
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new HttpError(400, `${key} must be a non-negative integer (minor units).`)
      }
      patch[column] = value
    }
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'active must be boolean.')
    patch.active = body.active
  }
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== 'number' || !Number.isInteger(body.sortOrder)) {
      throw new HttpError(400, 'sortOrder must be an integer.')
    }
    patch.sort_order = body.sortOrder
  }
  if (body.highlight !== undefined) {
    if (typeof body.highlight !== 'boolean') throw new HttpError(400, 'highlight must be boolean.')
    patch.highlight = body.highlight
  }
  if (body.seats !== undefined) {
    const seats = body.seats
    if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1 || seats > 100) {
      throw new HttpError(400, 'seats must be an integer between 1 and 100.')
    }
    patch.seats = seats
  }
  for (const key of ['pricePerSeatInr', 'pricePerSeatUsd'] as const) {
    if (body[key] !== undefined) {
      const column = key === 'pricePerSeatInr' ? 'price_per_seat_inr' : 'price_per_seat_usd'
      const value = body[key]
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new HttpError(400, `${key} must be a non-negative integer (minor units).`)
      }
      patch[column] = value
    }
  }
  for (const key of ['compareAtInr', 'compareAtUsd'] as const) {
    if (body[key] !== undefined) {
      const column = key === 'compareAtInr' ? 'compare_at_inr' : 'compare_at_usd'
      const value = body[key]
      if (value === null) {
        patch[column] = null
      } else if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new HttpError(400, `${key} must be a non-negative integer or null (minor units).`)
      } else {
        patch[column] = value
      }
    }
  }
  if (!partial && patch.months === undefined) patch.months = null
  if (!partial && patch.blurb === undefined) patch.blurb = ''
  if (!partial && patch.active === undefined) patch.active = true
  if (!partial && patch.sort_order === undefined) patch.sort_order = 0
  if (!partial && patch.highlight === undefined) patch.highlight = false
  if (!partial && patch.seats === undefined) patch.seats = 1
  if (!partial && patch.price_per_seat_inr === undefined) patch.price_per_seat_inr = 0
  if (!partial && patch.price_per_seat_usd === undefined) patch.price_per_seat_usd = 0
  if (patch.license_type === 'perpetual') patch.months = null
  if (patch.license_type === 'subscription' && patch.months === undefined && !partial) {
    throw new HttpError(400, 'Subscription plans need months >= 1.')
  }
  if (patch.license_type === 'subscription' && patch.months === null) {
    throw new HttpError(400, 'Subscription plans need months >= 1.')
  }
  return patch
}

async function createPlan(body: Record<string, unknown>): Promise<void> {
  const row = parsePlanFields(body, false)
  const { error } = await supabaseAdmin().from('plans').insert(row)
  if (error) throw new HttpError(400, error.code === '23505' ? `Plan ${row.id} already exists.` : error.message)
  invalidatePlanCache()
}

async function updatePlan(body: Record<string, unknown>): Promise<void> {
  const id = typeof body.id === 'string' ? body.id.trim().toLowerCase() : ''
  if (!id) throw new HttpError(400, 'id is required.')
  const patch = parsePlanFields({ ...body, id: undefined }, true)
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update.')
  const { error } = await supabaseAdmin().from('plans').update(patch).eq('id', id)
  if (error) throw new HttpError(400, error.message)
  invalidatePlanCache()
}

async function deletePlan(id: string): Promise<void> {
  if (!id) throw new HttpError(400, 'id is required.')
  const { error } = await supabaseAdmin().from('plans').delete().eq('id', id)
  if (error) throw new HttpError(500, `Could not delete plan: ${error.message}`)
  invalidatePlanCache()
}

async function setLicenseStatus(licenseId: string, status: string): Promise<void> {
  if (status !== 'active' && status !== 'revoked') throw new HttpError(400, 'Status must be active or revoked.')
  if (typeof licenseId !== 'string' || !licenseId) throw new HttpError(400, 'licenseId is required.')
  const { error } = await supabaseAdmin().from('licenses').update({ status }).eq('id', licenseId)
  if (error) throw new HttpError(500, `Could not update license: ${error.message}`)
}

async function assertPlanExists(planId: string): Promise<void> {
  const { data } = await supabaseAdmin().from('plans').select('id').eq('id', planId).single()
  if (!data) throw new HttpError(400, 'Unknown plan.')
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
  if (planId) await assertPlanExists(planId)

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
    if (planId !== null) {
      if (typeof planId !== 'string') throw new HttpError(400, 'Unknown plan.')
      await assertPlanExists(planId)
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
      if (resource === 'plans') {
        res.status(200).json(await listPlans())
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
        case 'createPlan':
          await createPlan(body)
          break
        case 'updatePlan':
          await updatePlan(body)
          break
        case 'deletePlan':
          await deletePlan(typeof body.id === 'string' ? body.id : '')
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
