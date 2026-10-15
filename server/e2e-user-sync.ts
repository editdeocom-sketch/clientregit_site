import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

const URL_ = process.env.VITE_SUPABASE_URL!
const ANON = process.env.VITE_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

const stamp = Date.now()
const password = 'E2eTest!234'
const emailA = `e2e-usersync-a-${stamp}@gmail.com`
const emailB = `e2e-usersync-b-${stamp}@gmail.com`

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function signIn(email: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const result = await client.auth.signInWithPassword({ email, password })
  if (result.error || !result.data.session) throw new Error(`sign in failed for ${email}: ${result.error?.message}`)
  return { client, userId: result.data.user!.id }
}

const iso = (offsetMs = 0): string => new Date(Date.now() + offsetMs).toISOString()

async function pushRows(client: SupabaseClient, rows: Array<Record<string, unknown>>): Promise<any> {
  const { data, error } = await client.rpc('sync_push_user', { p_rows: rows })
  if (error) throw new Error(`sync_push_user: ${error.message}`)
  return data
}

async function pullRows(client: SupabaseClient, since: string | null): Promise<any> {
  const { data, error } = await client.rpc('sync_pull_user', { p_since: since, p_limit: 1000 })
  if (error) throw new Error(`sync_pull_user: ${error.message}`)
  return data
}

async function main(): Promise<void> {
  console.log('--- 1. Users (service role) ---')
  await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true })
  await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true })
  const A = await signIn(emailA)
  const B = await signIn(emailB)
  check('both users sign in', true, `A=${A.userId.slice(0, 8)}…`)

  console.log('--- 2. Push as A ---')
  const clientRow = {
    entity: 'clients',
    row_id: 'c-user-sync-1',
    data: { id: 'c-user-sync-1', name: 'Sync Test Client', email: 'sync@test.dev' },
    updated_at: iso(),
    deleted: false
  }
  const projectRow = {
    entity: 'projects',
    row_id: 'p-user-sync-1',
    data: { id: 'p-user-sync-1', title: 'Sync Test Project', client_id: 'c-user-sync-1' },
    updated_at: iso(),
    deleted: false
  }
  const pushed = await pushRows(A.client, [clientRow, projectRow])
  check('push accepted', pushed.ok === true)

  console.log('--- 3. Pull as A (fresh cursor) ---')
  const pull = await pullRows(A.client, null)
  const rows = (pull.rows ?? []) as Array<{ entity: string; row_id: string; data: Record<string, unknown> }>
  check('pull ok', pull.ok === true)
  check('pulled 2 rows', rows.length === 2, `got ${rows.length}`)
  check('client row intact', rows.some((r) => r.row_id === 'c-user-sync-1' && r.data.name === 'Sync Test Client'))
  check('project row intact', rows.some((r) => r.row_id === 'p-user-sync-1'))
  check('server_now present', typeof pull.server_now === 'string')

  console.log('--- 4. Isolation: B pulls, sees nothing of A ---')
  const pullB = await pullRows(B.client, null)
  const rowsB = (pullB.rows ?? []) as unknown[]
  check('B pull ok', pullB.ok === true)
  check('B sees 0 rows', rowsB.length === 0, `got ${rowsB.length}`)

  console.log('--- 5. Last-write-wins: newer update overwrites ---')
  const older = { ...clientRow, data: { ...clientRow.data, name: 'Old Name' }, updated_at: iso(-60_000) }
  const newer = { ...clientRow, data: { ...clientRow.data, name: 'New Name' }, updated_at: iso() }
  await pushRows(A.client, [older])
  await pushRows(A.client, [newer])
  const pull2 = await pullRows(A.client, null)
  const clientAfter = ((pull2.rows ?? []) as Array<{ row_id: string; data: Record<string, unknown> }>).find(
    (r) => r.row_id === 'c-user-sync-1'
  )
  check('newer write wins', clientAfter?.data.name === 'New Name', String(clientAfter?.data.name))

  console.log('--- 6. Tombstone: delete propagates ---')
  const tombstone = { entity: 'projects', row_id: 'p-user-sync-1', data: {}, updated_at: iso(), deleted: true }
  await pushRows(A.client, [tombstone])
  const pull3 = await pullRows(A.client, null)
  const deletedRow = ((pull3.rows ?? []) as Array<{ row_id: string; deleted: boolean }>).find(
    (r) => r.row_id === 'p-user-sync-1'
  )
  check('delete tombstone returned', deletedRow?.deleted === true)

  console.log('--- 7. Cursor paging ---')
  const many = Array.from({ length: 25 }, (_, i) => ({
    entity: 'tasks',
    row_id: `t-page-${i}`,
    data: { id: `t-page-${i}`, title: `Task ${i}` },
    updated_at: iso(),
    deleted: false
  }))
  await pushRows(A.client, many)
  const full = await pullRows(A.client, null)
  check('full pull returns all tasks', ((full.rows ?? []) as unknown[]).length >= 25, `got ${((full.rows ?? []) as unknown[]).length}`)
  const sinceNow = await pullRows(A.client, full.server_now)
  check('pull after server_now returns 0', ((sinceNow.rows ?? []) as unknown[]).length === 0)

  console.log('--- 8. Invalid entity rejected silently (skipped) ---')
  const bad = await pushRows(A.client, [
    { entity: 'evil', row_id: 'x', data: {}, updated_at: iso(), deleted: false }
  ])
  check('bad entity push still ok', bad.ok === true)
  const pullBad = await pullRows(A.client, null)
  check('no evil rows stored', !((pullBad.rows ?? []) as Array<{ entity: string }>).some((r) => r.entity === 'evil'))

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('E2E crashed:', err)
  process.exit(1)
})
