import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
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
const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })

const stamp = Date.now()
const password = 'E2eTest!234'
const emailA = `e2e-team-a-${stamp}@gmail.com`
const emailB = `e2e-team-b-${stamp}@gmail.com`
const emailC = (n: number): string => `e2e-team-c${n}-${stamp}@gmail.com`
const emailD = `e2e-team-d-${stamp}@gmail.com`

const hex = (): string => stamp.toString(16).toUpperCase().padStart(16, '0').slice(-16)
const teamKey = `CRIT-${hex().slice(0, 4)}-${hex().slice(4, 8)}-${hex().slice(8, 12)}-${hex().slice(12, 16)}`
const individualKey = `CRIT-${'ABCD'.slice(0, 4)}-${'1234'.slice(0, 4)}-${'5678'.slice(0, 4)}-${String(stamp % 10000).padStart(4, '0')}`

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

async function signIn(email: string): Promise<{ client: SupabaseClient; token: string; userId: string }> {
  const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const result = await client.auth.signInWithPassword({ email, password })
  if (result.error || !result.data.session) throw new Error(`sign in failed for ${email}: ${result.error?.message}`)
  return { client, token: result.data.session.access_token, userId: result.data.user!.id }
}

async function rpc(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<any> {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}

async function createUser(email: string): Promise<string> {
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (result.error || !result.data.user) throw new Error(`createUser ${email}: ${result.error?.message}`)
  return result.data.user.id
}

const iso = (offsetMs = 0): string => new Date(Date.now() + offsetMs).toISOString()

async function main(): Promise<void> {
  console.log('--- 1. Users + licenses (service role) ---')
  const idA = await createUser(emailA)
  const idB = await createUser(emailB)
  const idsC = [await createUser(emailC(1)), await createUser(emailC(2)), await createUser(emailC(3)), await createUser(emailC(4))]
  const idD = await createUser(emailD)
  check('created 7 confirmed users', true, `A=${idA.slice(0, 8)}…`)

  const exp = new Date(Date.now() + 365 * 86400000).toISOString()
  const { error: licErr } = await admin.from('licenses').insert([
    { user_id: idA, license_key: teamKey, type: 'subscription', plan_id: 'team-5', status: 'active', expires_at: exp, seats: 5, seats_used: 0 },
    { user_id: idD, license_key: individualKey, type: 'subscription', plan_id: 'monthly', status: 'active', expires_at: exp, seats: 1, seats_used: 0 }
  ])
  check('inserted team-5 + individual licenses', !licErr, licErr?.message ?? teamKey)

  const A = await signIn(emailA)
  const B = await signIn(emailB)
  const Cs = await Promise.all(idsC.map((_, i) => signIn(emailC(i + 1))))
  const D = await signIn(emailD)
  check('all users sign in', true)

  console.log('--- 2. create_team ---')
  const created = await rpc(A.client, 'create_team', { p_name: 'E2E Studio', p_license_key: teamKey })
  check('create_team ok', created.ok === true, JSON.stringify(created))
  const again = await rpc(A.client, 'create_team', { p_name: 'Second', p_license_key: teamKey })
  check('second create_team → already_in_team', again.code === 'already_in_team', JSON.stringify(again))

  console.log('--- 3. Invite / accept ---')
  const inviteB = await rpc(A.client, 'invite_member', { p_email: emailB })
  check('invite B ok', inviteB.ok === true, JSON.stringify(inviteB))
  const invitesB = await A.client.from('team_invites').select('id, email').eq('status', 'pending')
  const inviteIdB = invitesB.data?.find((i) => i.email === emailB)?.id
  const acceptB = await rpc(B.client, 'accept_invite', { p_invite_id: inviteIdB })
  check('B accepts → joined', acceptB.ok === true, JSON.stringify(acceptB))
  const acceptB2 = await rpc(B.client, 'accept_invite', { p_invite_id: inviteIdB })
  check('B re-accept → not allowed', acceptB2.ok !== true, JSON.stringify(acceptB2))

  console.log('--- 4. Seat cap (5 members max) ---')
  // members = A,B (2). Invite C1, C2 now (invite-time check passes at 2 < 5).
  await rpc(A.client, 'invite_member', { p_email: emailC(1) })
  await rpc(A.client, 'invite_member', { p_email: emailC(2) })
  const invitesAll1 = await A.client.from('team_invites').select('id, email').eq('status', 'pending')
  const cid = (n: number): string | undefined => invitesAll1.data?.find((i) => i.email === emailC(n))?.id
  check('C1 + C2 invited', Boolean(cid(1)) && Boolean(cid(2)))
  check('C1 accepts (members → 3)', (await rpc(Cs[0].client, 'accept_invite', { p_invite_id: cid(1) })).ok === true)
  check('C2 accepts (members → 4)', (await rpc(Cs[1].client, 'accept_invite', { p_invite_id: cid(2) })).ok === true)
  // members = 4: invite C3 AND C4 while under the cap…
  await rpc(A.client, 'invite_member', { p_email: emailC(3) })
  await rpc(A.client, 'invite_member', { p_email: emailC(4) })
  const invitesAll2 = await A.client.from('team_invites').select('id, email').eq('status', 'pending')
  const cid2 = (n: number): string | undefined => invitesAll2.data?.find((i) => i.email === emailC(n))?.id
  check('C3 accepts (members → 5, full)', (await rpc(Cs[2].client, 'accept_invite', { p_invite_id: cid2(3) })).ok === true)
  const capAccept = await rpc(Cs[3].client, 'accept_invite', { p_invite_id: cid2(4) })
  check('C4 accept → seats_full', capAccept.code === 'seats_full', JSON.stringify(capAccept))
  const inviteAtCap = await rpc(A.client, 'invite_member', { p_email: `late-${stamp}@gmail.com` })
  check('invite at full seats → seats_full', inviteAtCap.code === 'seats_full', JSON.stringify(inviteAtCap))

  console.log('--- 5. Leader rules + revoke + member leave ---')
  const revoke = await rpc(A.client, 'revoke_invite', { p_invite_id: cid2(4) })
  check('leader revokes C4 invite', revoke.ok === true, JSON.stringify(revoke))
  const acceptRevoked = await rpc(Cs[3].client, 'accept_invite', { p_invite_id: cid2(4) })
  check('C4 accepts revoked → invite_invalid', acceptRevoked.code === 'invite_invalid', JSON.stringify(acceptRevoked))
  const leaderLeave = await rpc(A.client, 'leave_team', {})
  check('leader cannot leave', leaderLeave.code === 'leader_cannot_leave', JSON.stringify(leaderLeave))
  const memberLeave = await rpc(Cs[2].client, 'leave_team', {})
  check('member C3 leaves ok', memberLeave.ok === true, JSON.stringify(memberLeave))
  const removeB = await rpc(A.client, 'remove_member', { p_user_id: idB })
  check('leader removes B', removeB.ok === true, JSON.stringify(removeB))
  const inviteBack = await rpc(A.client, 'invite_member', { p_email: emailB })
  const invitesBack = await A.client.from('team_invites').select('id, email').eq('status', 'pending')
  const backId = invitesBack.data?.find((i) => i.email === emailB)?.id
  check('re-invite B ok', inviteBack.ok === true && Boolean(backId))
  check('B rejoins', (await rpc(B.client, 'accept_invite', { p_invite_id: backId })).ok === true)

  console.log('--- 6. Individual license cannot use team features ---')
  const indivCreate = await rpc(D.client, 'create_team', { p_name: 'Nope', p_license_key: individualKey })
  check('create_team with individual key → not_team_license', indivCreate.code === 'not_team_license', JSON.stringify(indivCreate))
  const indivClaim = await rpc(D.client, 'claim_seat', { p_license_key: individualKey, p_device_id: 'dev_x' })
  check('claim_seat on individual key → not_team', indivClaim.code === 'not_team', JSON.stringify(indivClaim))

  console.log('--- 7. Seat claiming (devices) ---')
  for (let i = 1; i <= 5; i++) {
    const claim = await rpc(A.client, 'claim_seat', { p_license_key: teamKey, p_device_id: `e2e_dev_${i}`, p_label: `Device ${i}` })
    check(`claim device ${i}`, claim.ok === true, JSON.stringify(claim))
  }
  const claim6 = await rpc(A.client, 'claim_seat', { p_license_key: teamKey, p_device_id: 'e2e_dev_6' })
  check('device 6 → seats_full', claim6.code === 'seats_full', JSON.stringify(claim6))
  const touch = await rpc(A.client, 'touch_seat', { p_license_key: teamKey, p_device_id: 'e2e_dev_1' })
  check('touch_seat registered', touch.ok === true && touch.registered === true, JSON.stringify(touch))
  const licRow = await admin.from('licenses').select('seats_used').eq('license_key', teamKey).single()
  check('licenses.seats_used = 5', licRow.data?.seats_used === 5, String(licRow.data?.seats_used))

  console.log('--- 8. Sync: push / pull / LWW / tombstones ---')
  const clientId = randomUUID()
  const projectId = randomUUID()
  const taskId = randomUUID()
  const invoiceId = randomUUID()
  const ghostId = randomUUID()
  const clientRow = {
    id: clientId, name: 'Sync Client', company: 'Acme', email: 'c@acme.test', phone: '', address: '',
    notes: '', tags: 'e2e', color: '#BF932A', currency: 'INR', archived: 0,
    created_at: iso(-300000), updated_at: iso(-300000)
  }
  const projectRow = {
    id: projectId, client_id: clientId, title: 'Team film', description: '', status: 'in_progress',
    priority: 'normal', deadline: null, delivered_at: null, quoted_amount: 50000, currency: 'INR',
    created_at: iso(-290000), updated_at: iso(-290000)
  }
  const taskRow = {
    id: taskId, project_id: projectId, title: 'Colour grade', done: 0, due_date: null,
    assignee_id: idB, position: 0, created_at: iso(-280000), updated_at: iso(-280000)
  }
  const invoiceRow = {
    id: invoiceId, invoice_number: `E2E-${stamp}`, client_id: clientId, project_id: projectId,
    issue_date: '2026-10-10', due_date: '2026-10-20', status: 'sent', currency: 'INR',
    subtotal: 1000, tax_percent: 18, tax_amount: 180, discount: 0, total: 1180, notes: 'e2e',
    created_at: iso(-270000), updated_at: iso(-270000),
    items: [{ id: randomUUID(), invoice_id: invoiceId, description: 'Edit', quantity: 1, rate: 1000, amount: 1000, position: 0 }],
    payments: [{ id: randomUUID(), invoice_id: invoiceId, amount: 500, paid_at: '2026-10-11', method: 'upi', reference: '', notes: '' }]
  }
  const push1 = await rpc(A.client, 'sync_push', {
    p_rows: [
      { entity: 'clients', row_id: clientId, data: clientRow, updated_at: clientRow.updated_at, deleted: false },
      { entity: 'projects', row_id: projectId, data: projectRow, updated_at: projectRow.updated_at, deleted: false },
      { entity: 'tasks', row_id: taskId, data: taskRow, updated_at: taskRow.updated_at, deleted: false },
      { entity: 'invoices', row_id: invoiceId, data: invoiceRow, updated_at: invoiceRow.updated_at, deleted: false }
    ]
  })
  check('A pushes 4 rows', push1.ok === true, JSON.stringify(push1))

  const pullB = await rpc(B.client, 'sync_pull', { p_since: null, p_limit: 1000 })
  const bRows = pullB.rows ?? []
  check('B pulls 4 rows', pullB.ok === true && bRows.length === 4, `got ${bRows.length}`)
  const bTask = bRows.find((r: any) => r.entity === 'tasks')
  check('pulled task carries assignee_id = B', bTask?.data?.assignee_id === idB, String(bTask?.data?.assignee_id))
  const bInvoice = bRows.find((r: any) => r.entity === 'invoices')
  check('pulled invoice embeds items + payments', (bInvoice?.data?.items?.length ?? 0) === 1 && (bInvoice?.data?.payments?.length ?? 0) === 1)
  const pullB2 = await rpc(B.client, 'sync_pull', { p_since: pullB.server_now, p_limit: 1000 })
  check('second pull with cursor returns 0 rows', (pullB2.rows ?? []).length === 0, `got ${(pullB2.rows ?? []).length}`)

  // LWW: B renames client with a NEWER timestamp.
  const renamed = { ...clientRow, name: 'Renamed by B', updated_at: iso(-1000) }
  await rpc(B.client, 'sync_push', { p_rows: [{ entity: 'clients', row_id: clientId, data: renamed, updated_at: renamed.updated_at, deleted: false }] })
  // A then pushes a STALE version.
  const stale = { ...clientRow, name: 'Stale from A', updated_at: iso(-600000) }
  await rpc(A.client, 'sync_push', { p_rows: [{ entity: 'clients', row_id: clientId, data: stale, updated_at: stale.updated_at, deleted: false }] })
  const serverRow = await admin.from('team_rows').select('data, updated_at').eq('row_id', clientId).single()
  check('server keeps newer (B) version', serverRow.data?.data?.name === 'Renamed by B', String(serverRow.data?.data?.name))

  const pullA = await rpc(A.client, 'sync_pull', { p_since: iso(-120000), p_limit: 1000 })
  const aRenamed = (pullA.rows ?? []).find((r: any) => r.entity === 'clients' && r.row_id === clientId)
  check('A pulls the newer rename', aRenamed?.data?.name === 'Renamed by B', String(aRenamed?.data?.name))

  // Tombstone: push live client, then delete it.
  const ghostLive = { ...clientRow, id: ghostId, name: 'Ghost', created_at: iso(-50000), updated_at: iso(-50000) }
  await rpc(A.client, 'sync_push', { p_rows: [{ entity: 'clients', row_id: ghostId, data: ghostLive, updated_at: ghostLive.updated_at, deleted: false }] })
  await rpc(A.client, 'sync_push', { p_rows: [{ entity: 'clients', row_id: ghostId, data: {}, updated_at: iso(-1000), deleted: true }] })
  const pullGhost = await rpc(B.client, 'sync_pull', { p_since: iso(-120000), p_limit: 1000 })
  const ghostRows = (pullGhost.rows ?? []).filter((r: any) => r.row_id === ghostId)
  check('B receives tombstone as final state (LWW overwrites live row)', ghostRows.length === 1 && ghostRows[0].deleted === true, JSON.stringify(ghostRows.map((r: any) => r.deleted)))

  console.log('--- 9. Roster + cleanup ---')
  const roster = await rpc(A.client, 'team_roster', {})
  check('roster has 4 members (A,B,C1,C2)', roster.ok === true && (roster.members ?? []).length === 4, `count=${(roster.members ?? []).length}`)
  const state = await rpc(A.client, 'team_state', {})
  check('team_state: role leader, seats 5, members 4', state.role === 'leader' && state.seats === 5 && (state.members ?? []).length === 4, JSON.stringify({ role: state.role, seats: state.seats, members: (state.members ?? []).length }))
  const blockedD = await admin.from('team_members').select('user_id').eq('user_id', idD)
  check('individual user D not in any team', (blockedD.data ?? []).length === 0)

  for (let i = 1; i <= 5; i++) {
    await rpc(A.client, 'release_seat', { p_license_key: teamKey, p_device_id: `e2e_dev_${i}` })
  }
  const afterRelease = await admin.from('licenses').select('seats_used').eq('license_key', teamKey).single()
  check('seats released → seats_used 0', afterRelease.data?.seats_used === 0, String(afterRelease.data?.seats_used))

  for (const uid of [...idsC, idD]) {
    await admin.auth.admin.deleteUser(uid)
  }
  check('cleaned up C1–C4 + D users (A and B kept)', true)

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
  console.log(`LEADER ACCOUNT: ${emailA} / ${password}`)
  console.log(`MEMBER ACCOUNT: ${emailB} / ${password}`)
  console.log(`TEAM LICENSE:   ${teamKey}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('E2E crashed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
