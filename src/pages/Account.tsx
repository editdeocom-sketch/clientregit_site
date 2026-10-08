import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { formatMoney, PLANS } from '@shared/plans'
import { SITE } from '@shared/site'

interface LicenseRow {
  id: string
  license_key: string
  type: 'perpetual' | 'subscription'
  plan_id: string
  status: 'active' | 'revoked'
  expires_at: string | null
  created_at: string
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
  total: number
  status: 'created' | 'paid'
  created_at: string
  paid_at: string | null
}

function LicenseCard({ license }: { license: LicenseRow }): ReactNode {
  const [copied, setCopied] = useState(false)
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
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{PLANS[license.plan_id as keyof typeof PLANS]?.name ?? license.plan_id}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            license.status === 'revoked'
              ? 'border-danger/30 bg-red-50 text-danger'
              : expired
                ? 'border-danger/30 bg-red-50 text-danger'
                : 'border-success/30 bg-green-50 text-success'
          }`}
        >
          {license.status === 'revoked' ? 'Revoked' : expired ? 'Expired' : 'Active'}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
        <code className="flex-1 truncate font-mono text-sm tracking-wider">{license.license_key}</code>
        <button
          onClick={() => void copy()}
          className="cursor-pointer rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold hover:border-gold hover:text-gold-strong"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {license.type === 'perpetual'
          ? 'Lifetime — never expires'
          : license.expires_at
            ? `Expires ${new Date(license.expires_at).toLocaleDateString()}`
            : 'Subscription'}
        {' · '}
        In the app: sign in with your account email → paste this key.
      </p>
    </div>
  )
}

function InvoiceView({ order, onClose }: { order: OrderRow; onClose: () => void }): ReactNode {
  const plan = PLANS[order.plan_id as keyof typeof PLANS]
  const date = new Date(order.paid_at ?? order.created_at).toLocaleDateString()
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
            <p>GSTIN: {order.currency === 'INR' ? SITE.gstin : '—'}</p>
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
                {plan?.name ?? order.plan_id} plan — {SITE.name} license
              </td>
              <td className="py-2 text-right">{formatMoney(order.subtotal, order.currency)}</td>
            </tr>
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

export function Account(): ReactNode {
  const { session, loading } = useSession()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'licenses' | 'orders'>(params.get('paid') ? 'orders' : 'licenses')
  const [licenses, setLicenses] = useState<LicenseRow[] | null>(null)
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [invoice, setInvoice] = useState<OrderRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let alive = true
    const load = async (): Promise<void> => {
      try {
        const [licenseResult, orderResult] = await Promise.all([
          supabase().from('licenses').select('*').order('created_at', { ascending: false }),
          supabase().from('orders').select('*').order('created_at', { ascending: false })
        ])
        if (!alive) return
        if (licenseResult.error) throw new Error(licenseResult.error.message)
        if (orderResult.error) throw new Error(orderResult.error.message)
        setLicenses(licenseResult.data as LicenseRow[])
        setOrders(orderResult.data as OrderRow[])
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [session])

  if (loading) return <div className="py-24 text-center text-sm text-muted">Loading…</div>
  if (!session) return <Navigate to="/auth?next=/account" replace />

  const signOut = async (): Promise<void> => {
    await supabase().auth.signOut()
    window.location.hash = '/'
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your account</h1>
          <p className="text-sm text-muted">{session.user.email}</p>
        </div>
        <button
          onClick={() => void signOut()}
          className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold-strong"
        >
          Sign out
        </button>
      </div>

      {params.get('paid') && (
        <div className="mt-5 rounded-xl border border-success/30 bg-green-50 px-4 py-3 text-sm text-success">
          Payment received — your license key is below. Paste it in the ClientRegit app to activate.
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-sm font-medium">
        <button
          onClick={() => setTab('licenses')}
          className={`cursor-pointer rounded-md py-2 ${tab === 'licenses' ? 'bg-surface shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          License keys
        </button>
        <button
          onClick={() => setTab('orders')}
          className={`cursor-pointer rounded-md py-2 ${tab === 'orders' ? 'bg-surface shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          Orders & invoices
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
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
            licenses.map((license) => <LicenseCard key={license.id} license={license} />)
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
                      {PLANS[order.plan_id as keyof typeof PLANS]?.name ?? order.plan_id} plan
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(order.paid_at ?? order.created_at).toLocaleDateString()} ·{' '}
                      {formatMoney(order.total, order.currency)}
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

      {invoice && <InvoiceView order={invoice} onClose={() => setInvoice(null)} />}
    </div>
  )
}
