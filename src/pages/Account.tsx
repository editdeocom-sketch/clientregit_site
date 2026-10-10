import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { usePlans } from '@/lib/plans'
import { fetchLicenseSeats, type LicenseSeatInfo } from '@/lib/api'
import { TeamTab } from '@/components/account/TeamTab'
import { formatMoney } from '@shared/plans'
import { APP_VERSION, DOWNLOADS, SITE } from '@shared/site'

interface LicenseRow {
  id: string
  license_key: string
  type: 'perpetual' | 'subscription'
  plan_id: string
  status: 'active' | 'revoked'
  expires_at: string | null
  created_at: string
  seats?: number
  seats_used?: number
}

interface SeatInfo {
  licenseId: string
  licenseKey: string
  planId: string
  status: string
  expiresAt: string | null
  seats: number
  seatsUsed: number
  devices: Array<{ device_id: string; label: string | null; last_seen_at: string }>
}

interface OrderRow {
  id: string
  razorpay_order_id: string
  payment_id: string | null
  plan_id: string
  currency: 'INR' | 'USD'
  subtotal: number
  tax_percent: number
  tax_amount: number
  discount_amount: number
  coupon_code: string | null
  total: number
  status: 'created' | 'paid'
  created_at: string
  paid_at: string | null
}

function maskKey(key: string): string {
  const parts = key.split('-')
  if (parts.length < 5) return '••••••••'
  return [parts[0], '••••', '••••', '••••', parts[4]].join('-')
}

function LicenseCard({
  license,
  planName,
  seatInfo
}: {
  license: LicenseRow
  planName: (id: string) => string
  seatInfo?: SeatInfo
}): ReactNode {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(license.license_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }
  const expired = license.expires_at && new Date(license.expires_at).getTime() < Date.now()
  const seats = seatInfo?.seats ?? license.seats ?? 1
  const seatsUsed = seatInfo?.seatsUsed ?? license.seats_used ?? 0
  const isTeam = seats > 1
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{planName(license.plan_id)}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            license.status === 'revoked' || expired
              ? 'border-danger/30 bg-red-50 text-danger'
              : 'border-success/30 bg-green-50 text-success'
          }`}
        >
          {license.status === 'revoked' ? 'Revoked' : expired ? 'Expired' : 'Active'}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
        <code className="flex-1 truncate font-mono text-sm tracking-wider">
          {revealed ? license.license_key : maskKey(license.license_key)}
        </code>
        <button
          onClick={() => setRevealed((v) => !v)}
          className="cursor-pointer rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold hover:border-gold hover:text-gold-strong"
        >
          {revealed ? 'Hide' : 'Show key'}
        </button>
        {revealed && (
          <button
            onClick={() => void copy()}
            className="cursor-pointer rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold hover:border-gold hover:text-gold-strong"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Started {formatDate(license.created_at)}
          {license.type === 'perpetual'
            ? ' · Lifetime — never expires'
            : license.expires_at
              ? ` · Expires ${formatDate(license.expires_at)}`
              : ' · Subscription'}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        In the app: sign in with your account email → paste this key.
      </p>

      {isTeam && (
        <div className="mt-4 rounded-lg border border-line bg-canvas p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold">
              {seatsUsed} of {seats} seats used
            </span>
            <Link
              to={`/checkout/${license.plan_id}?mode=seat_addon&qty=1`}
              className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold hover:border-gold hover:text-gold-strong"
            >
              + Add seats (₹299 / $5)
            </Link>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={seatsUsed} aria-valuemin={0} aria-valuemax={seats}>
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${Math.min(100, Math.round((seatsUsed / seats) * 100))}%` }}
            />
          </div>
          {seatInfo && seatInfo.devices.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-xs text-muted">
              {seatInfo.devices.map((device) => (
                <li key={device.device_id} className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono">{device.label || device.device_id.slice(0, 12)}</span>
                  <span>seen {formatDate(device.last_seen_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted">
            Team plans verify seats online each time the app opens. Deactivate a machine in the app to free its seat.
          </p>
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function InvoiceView({
  order,
  planName,
  onClose
}: {
  order: OrderRow
  planName: (id: string) => string
  onClose: () => void
}): ReactNode {
  const date = formatDate(order.paid_at ?? order.created_at)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-7 text-sm text-black shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Tax Invoice</h2>
            <p className="text-xs text-gray-500">Invoice #{order.razorpay_order_id.slice(-10)}</p>
          </div>
          <button onClick={onClose} className="cursor-pointer text-gray-400 hover:text-black">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-semibold">From</p>
            <p>{SITE.name}</p>
            <p>{SITE.address}</p>
            <p>{SITE.supportEmail}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">Billed to</p>
            <p>{date}</p>
            <p>Paid via Razorpay</p>
            {order.payment_id && <p className="font-mono">{order.payment_id}</p>}
          </div>
        </div>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2">
                {planName(order.plan_id)} plan — {SITE.name} license
              </td>
              <td className="py-2 text-right">{formatMoney(order.subtotal, order.currency)}</td>
            </tr>
            {order.discount_amount > 0 && (
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-gray-600">
                  Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}
                </td>
                <td className="py-1.5 text-right text-success">
                  −{formatMoney(order.discount_amount, order.currency)}
                </td>
              </tr>
            )}
            {order.tax_percent > 0 && (
              <>
                <tr>
                  <td className="py-1.5 text-gray-600">CGST @ 9%</td>
                  <td className="py-1.5 text-right">{formatMoney(Math.round(order.tax_amount / 2), order.currency)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-gray-600">SGST @ 9%</td>
                  <td className="py-1.5 text-right">{formatMoney(order.tax_amount - Math.round(order.tax_amount / 2), order.currency)}</td>
                </tr>
              </>
            )}
            <tr className="border-t border-gray-300 font-bold">
              <td className="py-2">Total{order.tax_percent > 0 ? ` (incl. GST @ ${order.tax_percent}%)` : ''}</td>
              <td className="py-2 text-right">{formatMoney(order.total, order.currency)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold"
          >
            Close
          </button>
          <button
            onClick={() => window.print()}
            className="cursor-pointer rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-white"
          >
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsPanel({ email }: { email: string }): ReactNode {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (password.length < 8) {
      setMessage({ ok: false, text: 'Password must be at least 8 characters.' })
      return
    }
    if (password !== confirm) {
      setMessage({ ok: false, text: 'Passwords do not match.' })
      return
    }
    setBusy(true)
    setMessage(null)
    const { error } = await supabase().auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setMessage({ ok: false, text: error.message })
      return
    }
    setPassword('')
    setConfirm('')
    setMessage({ ok: true, text: 'Password updated.' })
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold tracking-tight">Profile</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Email</dt>
            <dd className="font-medium">{email}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold tracking-tight">Change password</h2>
        <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          {message && (
            <p className={`text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>{message.text}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="cursor-pointer rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50"
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function Account(): ReactNode {
  const { session, loading } = useSession()
  const [params] = useSearchParams()
  const allPlans = usePlans()
  const planName = (id: string): string => allPlans?.find((p) => p.id === id)?.name ?? id
  const [tab, setTab] = useState<'overview' | 'licenses' | 'orders' | 'team' | 'settings'>(
    params.get('paid') ? 'orders' : params.get('tab') === 'team' ? 'team' : 'overview'
  )
  const [licenses, setLicenses] = useState<LicenseRow[] | null>(null)
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [seatInfo, setSeatInfo] = useState<LicenseSeatInfo[] | null>(null)
  const [invoice, setInvoice] = useState<OrderRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const load = useCallback(async (userId: string): Promise<void> => {
    try {
      const [licenseResult, orderResult, profileResult] = await Promise.all([
        supabase().from('licenses').select('*').order('created_at', { ascending: false }),
        supabase().from('orders').select('*').order('created_at', { ascending: false }),
        supabase().from('profiles').select('is_admin').eq('id', userId).single()
      ])
      if (licenseResult.error) throw new Error(licenseResult.error.message)
      if (orderResult.error) throw new Error(orderResult.error.message)
      setLicenses(licenseResult.data as LicenseRow[])
      setOrders(orderResult.data as OrderRow[])
      setIsAdmin(Boolean((profileResult.data as { is_admin?: boolean } | null)?.is_admin))
      fetchLicenseSeats()
        .then(setSeatInfo)
        .catch(() => {
          // seat meter falls back to values on the licenses row
        })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    if (!session) return
    let alive = true
    const run = async (): Promise<void> => {
      await load(session.user.id)
      return Promise.resolve()
    }
    void run().then(() => {
      if (!alive) return
    })
    return () => {
      alive = false
    }
  }, [session, load])

  if (loading) return <div className="py-24 text-center text-sm text-muted">Loading…</div>
  if (!session) return <Navigate to="/auth?next=/account" replace />

  const signOut = async (): Promise<void> => {
    await supabase().auth.signOut()
    window.location.hash = '/'
  }

  const activeLicenses = (licenses ?? []).filter(
    (l) => l.status === 'active' && (!l.expires_at || new Date(l.expires_at).getTime() > Date.now())
  )
  const teamLicenses = activeLicenses
    .filter((l) => (l.seats ?? 1) > 1)
    .map((l) => ({
      id: l.id,
      plan_id: l.plan_id,
      license_key: l.license_key,
      seats: l.seats ?? 1,
      expires_at: l.expires_at
    }))

  const memberSince = (session.user as { created_at?: string }).created_at
    ? formatDate((session.user as { created_at: string }).created_at)
    : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your account</h1>
          <p className="text-sm text-muted">{session.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Link
              to="/admin"
              className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold-strong hover:border-gold"
            >
              Admin panel
            </Link>
          )}
          <button
            onClick={() => void signOut()}
            className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold-strong"
          >
            Sign out
          </button>
        </div>
      </div>

      {params.get('paid') && (
        <div className="mt-5 rounded-xl border border-success/30 bg-green-50 px-4 py-3 text-sm text-success">
          Payment received — your license key is below. Paste it in the ClientRegit app to activate.
        </div>
      )}

      <div className="mt-6 grid grid-cols-5 gap-1 rounded-lg bg-surface-2 p-1 text-sm font-medium">
        {(['overview', 'licenses', 'orders', 'team', 'settings'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`cursor-pointer rounded-md py-2 capitalize ${tab === id ? 'bg-surface shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            {id === 'orders' ? 'Orders' : id}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {tab === 'overview' && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-semibold tracking-tight">Profile</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Email</dt>
                <dd className="font-medium">{session.user.email}</dd>
              </div>
              {memberSince && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Member since</dt>
                  <dd className="font-medium">{memberSince}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Active licenses</dt>
                <dd className="font-medium">{activeLicenses.length}</dd>
              </div>
            </dl>
          </div>

          {activeLicenses.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-5">
              <h2 className="font-semibold tracking-tight">Current subscription</h2>
              {activeLicenses.map((license) => (
                <div key={license.id} className="mt-3 space-y-1 text-sm">
                  <p className="font-medium">
                    {planName(license.plan_id)} plan
                  </p>
                  <p className="text-muted">
                    Started {formatDate(license.created_at)}
                    {license.type === 'perpetual'
                      ? ' · Lifetime — never expires'
                      : license.expires_at
                        ? ` · Expires ${formatDate(license.expires_at)}`
                        : ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold tracking-tight">Download the app</h2>
                <p className="text-sm text-muted">Available for Windows and macOS</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={DOWNLOADS.windows}
                  className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-strong"
                >
                  Download for Windows
                </a>
                <a
                  href={DOWNLOADS.macos}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-gold hover:text-gold-strong"
                >
                  Download for macOS
                </a>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Windows 10/11 x64 · macOS Apple Silicon · v{APP_VERSION}
            </p>
            <p className="mt-1 text-xs text-muted">
              macOS: right-click the app → Open on first launch (unsigned build)
            </p>
          </div>
        </div>
      )}

      {tab === 'licenses' && (
        <div className="mt-6 space-y-4">
          {licenses === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : licenses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
              <p className="text-sm font-semibold">No licenses yet</p>
              <p className="mt-1 text-sm text-muted">Buy a plan to get your activation key.</p>
              <Link
                to="/"
                onClick={() => setTimeout(() => document.getElementById('pricing')?.scrollIntoView(), 100)}
                className="mt-4 inline-block rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-strong"
              >
                See pricing
              </Link>
            </div>
          ) : (
            licenses.map((license) => (
              <LicenseCard
                key={license.id}
                license={license}
                planName={planName}
                seatInfo={
                  seatInfo?.find((s) => s.licenseId === license.id) ??
                  seatInfo?.find((s) => s.licenseKey === license.license_key)
                }
              />
            ))
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div className="mt-6 space-y-3">
          {orders === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
              No orders yet.
            </div>
          ) : (
            orders
              .filter((order) => order.status === 'paid')
              .map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {planName(order.plan_id)} plan
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(order.paid_at ?? order.created_at)} ·{' '}
                      {formatMoney(order.total, order.currency)}
                      {order.discount_amount > 0 ? ' (discount applied)' : ''}
                      {order.tax_amount > 0 ? ' (incl. GST)' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setInvoice(order)}
                    className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-xs font-semibold hover:border-gold hover:text-gold-strong"
                  >
                    View invoice
                  </button>
                </div>
              ))
          )}
        </div>
      )}

      {tab === 'team' && (
        <TeamTab
          userId={session.user.id}
          userEmail={session.user.email ?? ''}
          teamLicenses={teamLicenses}
        />
      )}

      {tab === 'settings' && <SettingsPanel email={session.user.email ?? ''} />}

      {invoice && <InvoiceView order={invoice} planName={planName} onClose={() => setInvoice(null)} />}
    </div>
  )
}
