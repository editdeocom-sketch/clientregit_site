import { getHeader, HttpError } from './http.js'
import { getUserFromToken, supabaseAdmin } from './supabase.js'

export async function requireAdmin(req: {
  headers: Record<string, string | string[] | undefined>
}): Promise<{ id: string; email?: string }> {
  const authorization = getHeader(req as never, 'authorization')
  if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in required.')
  const user = await getUserFromToken(authorization.slice('Bearer '.length))

  const { data } = await supabaseAdmin()
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!data?.is_admin) throw new HttpError(403, 'Admin access required.')
  return user
}
