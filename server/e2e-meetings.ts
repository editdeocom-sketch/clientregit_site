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

const stamp = Date.now()
const password = 'E2eTest!234'
const emailM1 = `e2e-meet-m1-${stamp}@gmail.com`
const emailM2 = `e2e-meet-m2-${stamp}@gmail.com`
const emailM3 = `e2e-meet-m3-${stamp}@gmail.com`
const teamKey = `CRMT-${stamp.toString(16).toUpperCase().padStart(16, '0').slice(-16)}`

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

const anonClient = (): SupabaseClient =>
  createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * Subscribes, waits until SUBSCRIBED, runs the trigger, then resolves with the
 * first matching event (or null after timeout). Ordering matters: firing the
 * trigger before the subscription is live silently drops the event.
 */
async function withListener<T>(
  client: SupabaseClient,
  channelName: string,
  listen: (ch: ReturnType<SupabaseClient['channel']>, resolve: (v: T) => void) => void,
  trigger: () => Promise<unknown>,
  timeoutMs = 8000
): Promise<T | null> {
  const ch = client.channel(channelName)
  return await new Promise<T | null>((resolvePromise) => {
    let done = false
    const timer = setTimeout(() => finish(null), timeoutMs)
    const finish = (value: T | null): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      void ch.unsubscribe()
      resolvePromise(value)
    }
    listen(ch, (value) => finish(value))
    void ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        trigger().catch(() => finish(null))
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        finish(null)
      }
    })
  })
}

const iso = (offsetMs = 0): string => new Date(Date.now() + offsetMs).toISOString()

async function main(): Promise<void> {
  console.log('--- 0. Migration present? ---')
  const probe = await admin.from('meetings').select('id').limit(1)
  if (probe.error) {
    console.error('MIGRATION NOT APPLIED — run supabase/migration-meetings.sql in the Supabase SQL Editor.')
    console.error(probe.error.message)
    process.exit(1)
  }
  check('meetings table exists', true)

  console.log('--- 1. Users + team (M1 leader, M2 member, M3 outsider) ---')
  const idM1 = await createUser(emailM1)
  const idM2 = await createUser(emailM2)
  const idM3 = await createUser(emailM3)
  const exp = new Date(Date.now() + 365 * 86400000).toISOString()
  const { error: licErr } = await admin.from('licenses').insert({
    user_id: idM1, license_key: teamKey, type: 'subscription', plan_id: 'team-5',
    status: 'active', expires_at: exp, seats: 5, seats_used: 0
  })
  check('inserted team license', !licErr, licErr?.message ?? teamKey)

  const M1 = await signIn(emailM1)
  const M2 = await signIn(emailM2)
  const M3 = await signIn(emailM3)
  check('all users sign in', true)

  const team = await rpc(M1.client, 'create_team', { p_name: 'Meet E2E', p_license_key: teamKey })
  check('create_team ok', team.ok === true, JSON.stringify(team))
  const invite = await rpc(M1.client, 'invite_member', { p_email: emailM2 })
  check('invite M2 ok', invite.ok === true, JSON.stringify(invite))
  const invites = await admin.from('team_invites').select('id').eq('status', 'pending').eq('email', emailM2).single()
  const accept = await rpc(M2.client, 'accept_invite', { p_invite_id: invites.data?.id })
  check('M2 accepts', accept.ok === true, JSON.stringify(accept))

  console.log('--- 2. create_meeting (team invitee + guest) ---')
  const created = await rpc(M1.client, 'create_meeting', {
    p_title: 'E2E Review',
    p_scheduled_at: iso(3600000),
    p_duration_min: 30,
    p_lobby_enabled: true,
    p_description: 'Agenda: cuts',
    p_member_ids: [idM2],
    p_guest: [{ name: 'Client X', email: 'x@client.test' }]
  })
  check('create_meeting ok', created.ok === true, JSON.stringify(created))
  const meetingId = created.id as string
  const code = created.code as string
  check('code is 10 chars', code?.length === 10, code ?? 'none')

  const mRow = await M1.client.from('meetings').select('*').eq('id', meetingId).single()
  check('host sees meeting, team_id set', mRow.data?.team_id !== null && mRow.data?.status === 'scheduled')
  const members = await M1.client.from('meeting_members').select('user_id, invite_status').eq('meeting_id', meetingId)
  check('M2 invited row exists', (members.data ?? []).some((r) => r.user_id === idM2), JSON.stringify(members.data))
  const guests = await M1.client.from('meeting_guests').select('name, email').eq('meeting_id', meetingId)
  check('guest row exists', (guests.data ?? []).some((g) => g.name === 'Client X'), JSON.stringify(guests.data))

  console.log('--- 3. create_meeting validation ---')
  const soloWithMembers = await rpc(M3.client, 'create_meeting', { p_title: 'Solo', p_member_ids: [idM1] })
  check('outsider invites member → no_team', soloWithMembers.code === 'no_team', JSON.stringify(soloWithMembers))
  const crossInvite = await rpc(M2.client, 'create_meeting', { p_title: 'X', p_member_ids: [idM3] })
  check('M2 invites non-team M3 → bad_members', crossInvite.code === 'bad_members', JSON.stringify(crossInvite))
  const soloOk = await rpc(M3.client, 'create_meeting', {
    p_title: 'Solo meeting', p_guest: [{ name: 'Freelancer' }]
  })
  check('solo meeting with guest ok', soloOk.ok === true && soloOk.code?.length === 10, JSON.stringify(soloOk))

  console.log('--- 4. get_meeting_by_code (anon = guest capability) ---')
  const guestInfo = await rpc(anonClient(), 'get_meeting_by_code', { p_code: code })
  check('anon fetch by code', guestInfo.ok === true && guestInfo.title === 'E2E Review', JSON.stringify(guestInfo))
  check('meeting returns host name', typeof guestInfo.host_name === 'string' && guestInfo.host_name.length > 0, String(guestInfo.host_name))
  check('lobby flag round-trips', guestInfo.lobby_enabled === true)
  const badInfo = await rpc(anonClient(), 'get_meeting_by_code', { p_code: 'ZZZZZZZZZZ' })
  check('unknown code → not_found', badInfo.code === 'not_found', JSON.stringify(badInfo))

  console.log('--- 5. RLS: listing + host-only updates ---')
  const m3List = await M3.client.from('meetings').select('id, host_user_id')
  const m3Foreign = (m3List.data ?? []).filter((r) => r.host_user_id !== idM3)
  check('outsider lists only own meetings', m3Foreign.length === 0, `foreign=${m3Foreign.length}, own=${(m3List.data ?? []).length - m3Foreign.length}`)
  const m2List = await M2.client.from('meetings').select('id')
  check('invitee lists the meeting', (m2List.data ?? []).some((r) => r.id === meetingId))
  const nonHostUpdate = await rpc(M2.client, 'update_meeting', { p_id: meetingId, p_title: 'Hacked' })
  check('non-host update_meeting → not_host', nonHostUpdate.code === 'not_host', JSON.stringify(nonHostUpdate))
  const nonHostStatus = await rpc(M2.client, 'set_meeting_status', { p_id: meetingId, p_status: 'live' })
  check('non-host set_meeting_status → not_host', nonHostStatus.code === 'not_host', JSON.stringify(nonHostStatus))
  const hostUpdate = await rpc(M1.client, 'update_meeting', { p_id: meetingId, p_title: 'E2E Review v2' })
  check('host update ok', hostUpdate.ok === true, JSON.stringify(hostUpdate))
  const badInvite = await M1.client.from('meeting_members').insert({ meeting_id: meetingId, user_id: idM3 })
  check('invite outsider to meeting → rejected', Boolean(badInvite.error), badInvite.error?.message ?? 'no error')

  console.log('--- 6. invitee responds ---')
  const respond = await M2.client
    .from('meeting_members')
    .update({ invite_status: 'accepted' })
    .eq('meeting_id', meetingId)
    .eq('user_id', idM2)
    .select('user_id')
  check('M2 accepts invite (direct RLS update)', !respond.error && (respond.data ?? []).length === 1, respond.error?.message ?? `rows=${(respond.data ?? []).length}`)
  const respondAsHost = await M1.client
    .from('meeting_members')
    .update({ invite_status: 'declined' })
    .eq('meeting_id', meetingId)
    .eq('user_id', idM2)
    .select('user_id')
  check('host can also update invite row', !respondAsHost.error && (respondAsHost.data ?? []).length === 1, respondAsHost.error?.message ?? `rows=${(respondAsHost.data ?? []).length}`)

  console.log('--- 7. in-call chat lifecycle (scheduled → live → ended) ---')
  const anonEarly = await anonClient().from('meeting_messages').insert({
    meeting_id: meetingId, sender_kind: 'guest', sender_id: 'g-early',
    sender_name: 'Early', body: 'too early'
  })
  check('anon chat while scheduled → rejected', Boolean(anonEarly.error), anonEarly.error?.message ?? 'no error')

  const goLive = await rpc(M1.client, 'set_meeting_status', { p_id: meetingId, p_status: 'live' })
  check('host starts meeting', goLive.ok === true, JSON.stringify(goLive))

  const anonLive = await anonClient().from('meeting_messages').insert({
    meeting_id: meetingId, sender_kind: 'guest', sender_id: 'guest-1',
    sender_name: 'Client X', body: 'Hello from browser'
  })
  check('anon chat while live → ok', !anonLive.error, anonLive.error?.message ?? 'ok')
  const memberChat = await M2.client.from('meeting_messages').insert({
    meeting_id: meetingId, sender_kind: 'user', sender_id: idM2,
    sender_name: 'M2', body: 'Hi client'
  })
  check('member chat while live → ok', !memberChat.error, memberChat.error?.message ?? 'ok')
  const anonRead = await anonClient().from('meeting_messages').select('id, body').eq('meeting_id', meetingId)
  check('anon reads transcript while live', (anonRead.data ?? []).length === 2, `got ${(anonRead.data ?? []).length}`)

  console.log('--- 8. realtime: chat INSERT + invite INSERT + broadcast ---')
  const chatEvent = await withListener<any>(anonClient(), `chat-${stamp}`, (ch, done) => {
    ch.on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'meeting_messages', filter: `meeting_id=eq.${meetingId}` },
      (payload) => done(payload))
  }, () => Promise.resolve(anonClient().from('meeting_messages').insert({
    meeting_id: meetingId, sender_kind: 'guest', sender_id: 'guest-2',
    sender_name: 'Guest 2', body: 'realtime ping'
  })))
  check('anon receives postgres_changes INSERT', chatEvent !== null && chatEvent.new?.body === 'realtime ping', JSON.stringify(chatEvent))

  let secondMeeting: any = null
  const inviteEvent = await withListener<any>(M2.client, `invite-${stamp}`, (ch, done) => {
    ch.on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'meeting_members', filter: `user_id=eq.${idM2}` },
      (payload) => done(payload))
  }, async () => {
    secondMeeting = await rpc(M1.client, 'create_meeting', { p_title: 'Standup', p_member_ids: [idM2] })
  })
  check('second meeting created', secondMeeting?.ok === true, JSON.stringify(secondMeeting))
  check('invitee receives invite INSERT (notification path)', inviteEvent !== null && inviteEvent.new?.meeting_id === secondMeeting?.id, JSON.stringify(inviteEvent))

  const guestA = anonClient()
  const guestB = anonClient()
  const chA = guestA.channel(`meet:${code}`)
  const chB = guestB.channel(`meet:${code}`)
  let bcast: any = null
  chB.on('broadcast', { event: 'offer' }, (payload) => { bcast = payload })
  await new Promise<void>((r) => chB.subscribe((status) => { if (status === 'SUBSCRIBED') r() }))
  await new Promise<void>((r) => chA.subscribe((status) => { if (status === 'SUBSCRIBED') r() }))
  const sendRes = await chA.send({ type: 'broadcast', event: 'offer', payload: { sdp: 'fake-sdp' } })
  for (let i = 0; i < 50 && !bcast; i++) await new Promise((r) => setTimeout(r, 100))
  await chA.unsubscribe()
  await chB.unsubscribe()
  const sendErr = (sendRes as { error?: string }).error
  const sendOk = sendRes === 'ok' || !sendErr
  check('anon broadcast signaling works', sendOk && bcast?.payload?.sdp === 'fake-sdp',
    JSON.stringify({ sendRes, bcast }))

  console.log('--- 9. call sessions + history ---')
  // Guest writes use a client-generated id and no RETURNING: guests cannot
  // SELECT these rows, and INSERT ... RETURNING requires SELECT visibility.
  const sessionId = randomUUID()
  const session = await anonClient().from('call_sessions').insert({ id: sessionId, meeting_id: meetingId })
  check('guest opens call session while live → ok', !session.error, session.error?.message ?? 'ok')
  const participant = await anonClient().from('call_participants').insert({
    id: randomUUID(), session_id: sessionId, meeting_id: meetingId, participant_kind: 'guest',
    participant_id: 'guest-1', name: 'Client X'
  })
  check('guest joins as participant → ok', !participant.error, participant.error?.message ?? 'ok')
  const memberSees = await M2.client.from('call_participants').select('name').eq('meeting_id', meetingId)
  check('member reads participants', (memberSees.data ?? []).some((p) => p.name === 'Client X'), JSON.stringify(memberSees.data))
  const anonHist = await anonClient().from('call_participants').select('name').eq('meeting_id', meetingId)
  check('anon cannot read history', (anonHist.data ?? []).length === 0, `got ${(anonHist.data ?? []).length}`)

  console.log('--- 10. end meeting → session closed by trigger, anon locked out ---')
  const endMeeting = await rpc(M1.client, 'set_meeting_status', { p_id: meetingId, p_status: 'ended' })
  check('host ends meeting', endMeeting.ok === true, JSON.stringify(endMeeting))
  const sessionAfter = await admin.from('call_sessions').select('ended_at').eq('meeting_id', meetingId)
  check('open session auto-closed by trigger',
    (sessionAfter.data ?? []).length === 1 && (sessionAfter.data ?? []).every((s) => s.ended_at !== null),
    JSON.stringify(sessionAfter.data))
  const anonAfter = await anonClient().from('meeting_messages').select('id').eq('meeting_id', meetingId)
  check('anon locked out after end', (anonAfter.data ?? []).length === 0, `got ${(anonAfter.data ?? []).length}`)
  const anonWriteAfter = await anonClient().from('meeting_messages').insert({
    meeting_id: meetingId, sender_kind: 'guest', sender_id: 'g', sender_name: 'G', body: 'late'
  })
  check('anon write after end → rejected', Boolean(anonWriteAfter.error), anonWriteAfter.error?.message ?? 'no error')

  console.log('--- 11. 1:1 conversations + messages ---')
  const conv1 = await rpc(M1.client, 'get_or_create_conversation', { p_other: idM2 })
  check('A creates conversation', conv1.ok === true && Boolean(conv1.id), JSON.stringify(conv1))
  const conv2 = await rpc(M2.client, 'get_or_create_conversation', { p_other: idM1 })
  check('B gets same conversation (canonical pair)', conv2.ok === true && conv2.id === conv1.id, JSON.stringify(conv2))
  const convBad = await rpc(M2.client, 'get_or_create_conversation', { p_other: idM3 })
  check('conversation with outsider → not_in_team', convBad.code === 'not_in_team', JSON.stringify(convBad))
  const convSelf = await rpc(M1.client, 'get_or_create_conversation', { p_other: idM1 })
  check('conversation with self → bad_other', convSelf.code === 'bad_other', JSON.stringify(convSelf))

  const send1Ref: { res: { data: { id: string } | null; error: any } | null } = { res: null }
  const msgEvent = await withListener<any>(M2.client, `msg-${stamp}`, (ch, done) => {
    ch.on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv1.id}` },
      (payload) => done(payload))
  }, async () => {
    send1Ref.res = await M1.client.from('messages').insert({
      conversation_id: conv1.id, sender_id: idM1, body: 'Hey, review cut v2'
    }).select('id').single()
  })
  check('A sends message', !send1Ref.res?.error && Boolean(send1Ref.res?.data), String(send1Ref.res?.error?.message ?? 'ok'))
  const bReads = await M2.client.from('messages').select('id, body, read_at').eq('conversation_id', conv1.id)
  check('B reads message', (bReads.data ?? []).length === 1 && bReads.data![0].body === 'Hey, review cut v2', JSON.stringify(bReads.data))
  const bMarks = await M2.client.from('messages').update({ read_at: iso() }).eq('id', send1Ref.res!.data!.id).select('id')
  check('recipient marks read', !bMarks.error && (bMarks.data ?? []).length === 1, bMarks.error?.message ?? `rows=${(bMarks.data ?? []).length}`)

  const cReads = await M3.client.from('messages').select('id').eq('conversation_id', conv1.id)
  check('outsider reads 0 messages', (cReads.data ?? []).length === 0, `got ${(cReads.data ?? []).length}`)
  const cSends = await M3.client.from('messages').insert({
    conversation_id: conv1.id, sender_id: idM3, body: 'intruder'
  })
  check('outsider send → rejected', Boolean(cSends.error), cSends.error?.message ?? 'no error')
  const cConv = await M3.client.from('conversations').select('id').eq('id', conv1.id)
  check('outsider cannot see conversation', (cConv.data ?? []).length === 0)

  check('B receives message INSERT realtime', msgEvent !== null && msgEvent.new?.body !== undefined, JSON.stringify(msgEvent))

  const send2 = await M2.client.from('messages').insert({
    conversation_id: conv1.id, sender_id: idM2, body: 'On it'
  })
  check('B replies', !send2.error, send2.error?.message ?? 'ok')
  const unread = await M1.client.from('messages').select('id')
    .eq('conversation_id', conv1.id).is('read_at', null).neq('sender_id', idM1)
  check('A has 1 unread', (unread.data ?? []).length === 1, `got ${(unread.data ?? []).length}`)

  console.log('--- 12. host deletes meeting → cascade ---')
  const delMeeting = await M1.client.from('meetings').delete().eq('id', meetingId)
  check('host deletes meeting', !delMeeting.error, delMeeting.error?.message ?? 'ok')
  const [msgsLeft, sessLeft, memberRows] = await Promise.all([
    admin.from('meeting_messages').select('id').eq('meeting_id', meetingId),
    admin.from('call_sessions').select('id').eq('meeting_id', meetingId),
    admin.from('meeting_members').select('user_id').eq('meeting_id', meetingId)
  ])
  check('chat/sessions/members cascaded', (msgsLeft.data ?? []).length === 0 && (sessLeft.data ?? []).length === 0 && (memberRows.data ?? []).length === 0,
    JSON.stringify({ m: (msgsLeft.data ?? []).length, s: (sessLeft.data ?? []).length, u: (memberRows.data ?? []).length }))

  console.log('--- 13. cleanup (all e2e-meet users, incl. leftovers from failed runs) ---')
  const listed = await admin.auth.admin.listUsers()
  const leftoverIds = (listed.data?.users ?? [])
    .filter((u) => u.email?.includes('e2e-meet-'))
    .map((u) => u.id)
  if (leftoverIds.length > 0) {
    await admin.from('teams').delete().in('leader_id', leftoverIds)
    await admin.from('licenses').delete().in('user_id', leftoverIds)
    for (const uid of leftoverIds) await admin.auth.admin.deleteUser(uid)
  }
  check(`cleaned up ${leftoverIds.length} users (+ teams, licenses)`, true)

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('E2E crashed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
