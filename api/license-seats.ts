import type { HandlerRequest, HandlerResponse } from './_lib/http.js'
import { getHeader, HttpError } from './_lib/http.js'
import { getUserFromToken, supabaseAdmin } from './_lib/supabase.js'

interface DeviceRow {
  device_id: string
  label: string | null
  last_seen_at: string
}

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  try {
    const authorization = getHeader(req, 'authorization')
    if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in required.')
    const user = await getUserFromToken(authorization.slice('Bearer '.length))

    const db = supabaseAdmin()
    const { data: licenses, error } = await db
      .from('licenses')
      .select('id, license_key, plan_id, seats, seats_used, status, expires_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw new HttpError(500, `Could not load licenses: ${error.message}`)

    const rows = licenses ?? []
    const teamRows = rows.filter((l) => (l.seats ?? 1) > 1)

    const seatInfo = await Promise.all(
      teamRows.map(async (license) => {
        const { data: devices, error: deviceError } = await db
          .from('license_devices')
          .select('device_id, label, last_seen_at')
          .eq('license_id', license.id)
          .order('last_seen_at', { ascending: false })
        if (deviceError) throw new HttpError(500, `Could not load devices: ${deviceError.message}`)
        return {
          licenseId: license.id,
          licenseKey: license.license_key,
          planId: license.plan_id,
          status: license.status,
          expiresAt: license.expires_at,
          seats: license.seats ?? 1,
          seatsUsed: devices?.length ?? license.seats_used ?? 0,
          devices: (devices ?? []) as DeviceRow[]
        }
      })
    )

    res.status(200).json({ seats: seatInfo })
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    res.status(statusCode).json({ error: message })
  }
}
