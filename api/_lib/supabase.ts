import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from './http.js'

let admin: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      throw new Error('Server is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
    }
    admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  }
  return admin
}

export async function getUserFromToken(token: string): Promise<{ id: string; email?: string }> {
  const { data, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Sign in again.')
  return { id: data.user.id, email: data.user.email }
}
