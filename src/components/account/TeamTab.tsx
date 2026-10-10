import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface TeamMemberInfo {
  user_id: string
  email: string | null
  role: 'leader' | 'member'
  joined_at: string
}

interface TeamInviteInfo {
  id: string
  team_id: string
  email: string
  status: string
  created_at: string
  expires_at: string
}

interface TeamInfo {
  id: string
  name: string
  leader_id: string
  created_at: string
}

interface TeamStateData {
  team: TeamInfo | null
  role: 'leader' | 'member' | null
  members: TeamMemberInfo[]
  invites: TeamInviteInfo[]
  seats: number
}

interface TeamLicenseInfo {
  id: string
  plan_id: string
  license_key: string
  seats: number
  expires_at: string | null
}

const RPC_ERRORS: Record<string, string> = {
  bad_name: 'Enter a team name.',
  already_in_team: 'You are already in a team.',
  license_not_found: 'That license key is not on your account.',
  license_inactive: 'That license is not active.',
  not_team_license: 'That is not a Team plan — pick a multi-seat license.',
  not_leader: 'Only the team leader can do that.',
  seats_full: 'All seats are taken. Remove a member or add seats first.',
  already_member: 'That person is already on the team.',
  bad_email: 'Enter a valid email address.',
  email_mismatch: 'This invite was sent to a different email — sign in with that address.',
  invite_invalid: 'This invite has expired or was revoked.',
  leader_cannot_leave: 'The leader cannot leave. Remove members instead.',
  not_in_team: 'You are not in a team.'
}

function rpcMessage(code: string | undefined, fallback: string): string {
  return (code && RPC_ERRORS[code]) || fallback
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

interface TeamTabProps {
  userId: string
  userEmail: string
  teamLicenses: TeamLicenseInfo[]
}

export function TeamTab({ userId, userEmail, teamLicenses }: TeamTabProps): ReactNode {
  const [state, setState] = useState<TeamStateData | null>(null)
  const [pendingInvites, setPendingInvites] = useState<TeamInviteInfo[]>([])
  const [teamName, setTeamName] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const [stateResult, inviteResult] = await Promise.all([
      supabase().rpc('team_state'),
      supabase()
        .from('team_invites')
        .select('id, team_id, email, status, created_at, expires_at')
        .eq('status', 'pending')
    ])
    if (stateResult.error) {
      setError(stateResult.error.message)
      return
    }
    setState(stateResult.data as TeamStateData)
    const rows = (inviteResult.data ?? []) as TeamInviteInfo[]
    setPendingInvites(
      inviteResult.error ? [] : rows.filter((r) => r.email.toLowerCase() === userEmail.toLowerCase())
    )
  }, [userEmail])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = async (fn: () => Promise<{ code?: string; ok?: boolean }>, okMessage: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await fn()
      if (!result?.ok) {
        setError(rpcMessage(result?.code, 'Something went wrong. Try again.'))
      } else {
        setNotice(okMessage)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const createTeam = async (): Promise<void> => {
    const key = licenseKey || teamLicenses[0]?.license_key
    if (!key) return setError('Pick a Team license to use.')
    await run(
      async () => {
        const { data, error } = await supabase().rpc('create_team', {
          p_name: teamName,
          p_license_key: key
        })
        if (error) throw new Error(error.message)
        return data as { ok?: boolean; code?: string }
      },
      'Team created. Invite your members below.'
    )
  }

  const acceptInvite = async (inviteId: string): Promise<void> => {
    await run(async () => {
      const { data, error } = await supabase().rpc('accept_invite', { p_invite_id: inviteId })
      if (error) throw new Error(error.message)
      return data as { ok?: boolean; code?: string }
    }, 'You joined the team. The app will sync on next launch.')
  }

  const inviteMember = async (): Promise<void> => {
    await run(async () => {
      const { data, error } = await supabase().rpc('invite_member', { p_email: inviteEmail })
      if (error) throw new Error(error.message)
      return data as { ok?: boolean; code?: string }
    }, `Invite sent to ${inviteEmail}.`)
    setInviteEmail('')
  }

  const revokeInvite = async (inviteId: string): Promise<void> => {
    await run(async () => {
      const { data, error } = await supabase().rpc('revoke_invite', { p_invite_id: inviteId })
      if (error) throw new Error(error.message)
      return data as { ok?: boolean; code?: string }
    }, 'Invite revoked.')
  }

  const removeMember = async (memberId: string): Promise<void> => {
    if (!window.confirm('Remove this member from the team? Their app will stop syncing.')) return
    await run(async () => {
      const { data, error } = await supabase().rpc('remove_member', { p_user_id: memberId })
      if (error) throw new Error(error.message)
      return data as { ok?: boolean; code?: string }
    }, 'Member removed.')
  }

  const leaveTeam = async (): Promise<void> => {
    if (!window.confirm('Leave this team? Your app will stop syncing shared data.')) return
    await run(async () => {
      const { data, error } = await supabase().rpc('leave_team')
      if (error) throw new Error(error.message)
      return data as { ok?: boolean; code?: string }
    }, 'You left the team.')
  }

  const input =
    'mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-gold focus:outline-none'
  const btnPrimary =
    'cursor-pointer rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50'
  const btnGhost =
    'cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:border-gold hover:text-gold-strong disabled:opacity-50'

  if (state === null) {
    return <p className="mt-6 text-sm text-muted">Loading team…</p>
  }

  if (error) {
    return (
      <div className="mt-5 rounded-lg border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    )
  }

  // Invitee: no team yet, but a pending invite exists for this email.
  if (!state.team && pendingInvites.length > 0) {
    return (
      <div className="mt-6 space-y-4">
        {pendingInvites.map((invite) => (
          <InviteCard
            key={invite.id}
            invite={invite}
            busy={busy}
            onAccept={() => void acceptInvite(invite.id)}
          />
        ))}
      </div>
    )
  }

  // No team: create one with an eligible Team license.
  if (!state.team) {
    if (teamLicenses.length === 0) {
      return (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold">No Team license on this account</p>
          <p className="mt-1 text-sm text-muted">
            A Team plan (5, 8 or 10 seats) is needed to create a shared workspace.
          </p>
          <Link
            to="/"
            onClick={() => setTimeout(() => document.getElementById('pricing')?.scrollIntoView(), 100)}
            className="mt-4 inline-block rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-strong"
          >
            See Team plans
          </Link>
        </div>
      )
    }
    return (
      <div className="mt-6 space-y-5">
        {notice && (
          <div className="rounded-lg border border-success/30 bg-green-50 px-4 py-3 text-sm text-success">
            {notice}
          </div>
        )}
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-semibold tracking-tight">Create a team workspace</h2>
          <p className="mt-1 text-sm text-muted">
            Your clients, projects, tasks and invoices will sync to every member of the team. You
            stay in control: you assign the work, members do it.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted">Team name</span>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Sunrise Edits"
                className={input}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted">Team license</span>
              {teamLicenses.length === 1 ? (
                <div className="mt-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm">
                  {teamLicenses[0].plan_id} — {teamLicenses[0].seats} seats
                  <span className="ml-2 font-mono text-xs text-muted">
                    {teamLicenses[0].license_key}
                  </span>
                </div>
              ) : (
                <select
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  className={input}
                >
                  <option value="">Pick a license…</option>
                  {teamLicenses.map((l) => (
                    <option key={l.license_key} value={l.license_key}>
                      {l.plan_id} — {l.seats} seats
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
          <button onClick={() => void createTeam()} disabled={busy} className={`${btnPrimary} mt-4`}>
            {busy ? 'Creating…' : 'Create team'}
          </button>
        </div>
      </div>
    )
  }

  // Team view.
  const { team, role, members, invites, seats } = state
  const isLeader = role === 'leader'
  const invitesLeft = Math.max(0, seats - members.length)

  return (
    <div className="mt-6 space-y-5">
      {notice && (
        <div className="rounded-lg border border-success/30 bg-green-50 px-4 py-3 text-sm text-success">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold tracking-tight">{team.name}</h2>
            <p className="text-xs text-muted">
              Created {formatDate(team.created_at)} · {members.length} of {seats} members
            </p>
          </div>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold-strong">
            {isLeader ? 'You are the leader' : 'Member'}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={members.length} aria-valuemin={0} aria-valuemax={seats}>
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${Math.min(100, Math.round((members.length / Math.max(1, seats)) * 100))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Synced data: clients, projects, tasks, invoices, invoice items and payments. Every member
          runs the desktop app signed in with the email below.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-sm font-semibold tracking-tight">Members</h3>
        <ul className="mt-3 divide-y divide-line/60">
          {members.map((member) => (
            <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {member.email ?? member.user_id}
                  {member.user_id === userId && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                </p>
                <p className="text-xs text-muted">joined {formatDate(member.joined_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    member.role === 'leader'
                      ? 'border-gold/40 bg-gold/10 text-gold-strong'
                      : 'border-line bg-surface-2 text-muted'
                  }`}
                >
                  {member.role === 'leader' ? 'Leader' : 'Member'}
                </span>
                {isLeader && member.role !== 'leader' && (
                  <button onClick={() => void removeMember(member.user_id)} disabled={busy} className={btnGhost}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {isLeader && (
          <div className="mt-4 border-t border-line pt-4">
            <label className="block text-sm">
              <span className="text-xs font-medium text-muted">
                Invite a member by email ({invitesLeft} seat{invitesLeft === 1 ? '' : 's'} left)
              </span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className={input}
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void inviteMember()}
                disabled={busy || invitesLeft === 0}
                className={btnPrimary}
              >
                {busy ? 'Sending…' : 'Send invite'}
              </button>
              {invitesLeft === 0 && (
                <span className="text-xs text-warn">
                  No seats left — add seats from your Licenses tab.
                </span>
              )}
            </div>

            {invites.length > 0 && (
              <ul className="mt-4 space-y-2">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
                  >
                    <span className="truncate">{invite.email}</span>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>expires {formatDate(invite.expires_at)}</span>
                      <button
                        onClick={() => void revokeInvite(invite.id)}
                        disabled={busy}
                        className="cursor-pointer font-semibold text-danger hover:underline"
                      >
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!isLeader && (
          <div className="mt-4 border-t border-line pt-4">
            <button onClick={() => void leaveTeam()} disabled={busy} className={btnGhost}>
              Leave team
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">
        <p>
          <span className="font-semibold text-ink">How it works:</span> sign in to the ClientRegit
          desktop app with your account email. The workspace syncs automatically, and only the
          leader can assign tasks.
        </p>
      </div>
    </div>
  )
}

function InviteCard({
  invite,
  busy,
  onAccept
}: {
  invite: TeamInviteInfo
  busy: boolean
  onAccept: () => void
}): ReactNode {
  const [teamName, setTeamName] = useState<string | null>(null)
  useEffect(() => {
    void supabase()
      .from('teams')
      .select('name')
      .eq('id', invite.team_id)
      .maybeSingle()
      .then(({ data }) => setTeamName((data as { name?: string } | null)?.name ?? 'a team'))
  }, [invite.team_id])

  return (
    <div className="rounded-xl border border-gold/40 bg-gold/5 p-5">
      <h2 className="font-semibold tracking-tight">You have been invited to {teamName ?? '…'}</h2>
      <p className="mt-1 text-sm text-muted">
        Invitation sent to {invite.email} · expires {formatDate(invite.expires_at)}. Joining shares
        the team's clients, projects, tasks and invoices with your app, and your local data joins
        the workspace too.
      </p>
      <button
        onClick={onAccept}
        disabled={busy}
        className="mt-4 cursor-pointer rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50"
      >
        {busy ? 'Joining…' : 'Join team'}
      </button>
    </div>
  )
}
