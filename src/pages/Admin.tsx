import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { usePlanName, usePlans } from '@/lib/plans'
import {
  adminCoupons,
  adminCreateCoupon,
  adminCreatePlan,
  adminDeleteCoupon,
  adminDeletePlan,
  adminLicenses,
  adminOrders,
  adminPlans,
  adminSetLicenseStatus,
  adminUpdateCoupon,
  adminUpdatePlan,
  adminUsers,
  type AdminCouponRow,
  type AdminLicenseRow,
  type AdminOrderRow,
  type AdminPlanRow,
  type AdminUserRow
} from '@/lib/api'
import { formatMoney } from '@shared/plans'

type Tab = 'users' | 'licenses' | 'orders' | 'coupons' | 'plans'

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted'
const TD = 'px-3 py-2 text-sm'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function UsersTab(): ReactNode {
  const [rows, setRows] = useState<AdminUserRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    adminUsers()
      .then((r) => setRows(r.users))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  if (error) return <p className="mt-4 text-sm text-danger">{error}</p>
  if (!rows) return <p className="mt-4 text-sm text-muted">Loading…</p>
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={TH}>Email</th>
            <th className={TH}>Joined</th>
            <th className={TH}>Licenses</th>
            <th className={TH}>Orders</th>
            <th className={TH}>Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-line/50 last:border-0">
              <td className={`${TD} font-medium`}>{u.email ?? u.id.slice(0, 8)}</td>
              <td className={`${TD} text-muted`}>{fmtDate(u.created_at)}</td>
              <td className={TD}>{u.license_count}</td>
              <td className={TD}>{u.order_count}</td>
              <td className={TD}>
                {u.is_admin ? (
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold-strong">
                    Admin
                  </span>
                ) : (
                  <span className="text-muted">User</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LicensesTab(): ReactNode {
  const planName = usePlanName()
  const [rows, setRows] = useState<AdminLicenseRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback((): void => {
    adminLicenses()
      .then((r) => setRows(r.licenses))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  useEffect(load, [load])

  const toggle = async (license: AdminLicenseRow): Promise<void> => {
    const next = license.status === 'active' ? 'revoked' : 'active'
    try {
      await adminSetLicenseStatus(license.id, next)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (error) return <p className="mt-4 text-sm text-danger">{error}</p>
  if (!rows) return <p className="mt-4 text-sm text-muted">Loading…</p>
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={TH}>Key</th>
            <th className={TH}>User</th>
            <th className={TH}>Plan</th>
            <th className={TH}>Status</th>
            <th className={TH}>Expires</th>
            <th className={TH}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-b border-line/50 last:border-0">
              <td className={`${TD} font-mono text-xs`}>{l.license_key}</td>
              <td className={`${TD} text-muted`}>{l.email ?? l.user_id.slice(0, 8)}</td>
              <td className={TD}>{planName(l.plan_id)}</td>
              <td className={TD}>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    l.status === 'active'
                      ? 'border-success/30 bg-green-50 text-success'
                      : 'border-danger/30 bg-red-50 text-danger'
                  }`}
                >
                  {l.status}
                </span>
              </td>
              <td className={`${TD} text-muted`}>
                {l.type === 'perpetual' ? 'Never' : fmtDate(l.expires_at)}
              </td>
              <td className={TD}>
                <button
                  onClick={() => void toggle(l)}
                  className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold ${
                    l.status === 'active'
                      ? 'border-danger/30 text-danger hover:bg-red-50'
                      : 'border-success/30 text-success hover:bg-green-50'
                  }`}
                >
                  {l.status === 'active' ? 'Revoke' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrdersTab(): ReactNode {
  const planName = usePlanName()
  const [rows, setRows] = useState<AdminOrderRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    adminOrders()
      .then((r) => setRows(r.orders))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  if (error) return <p className="mt-4 text-sm text-danger">{error}</p>
  if (!rows) return <p className="mt-4 text-sm text-muted">Loading…</p>
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={TH}>User</th>
            <th className={TH}>Plan</th>
            <th className={TH}>Amount</th>
            <th className={TH}>Coupon</th>
            <th className={TH}>Status</th>
            <th className={TH}>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-b border-line/50 last:border-0">
              <td className={`${TD} text-muted`}>{o.email ?? o.user_id.slice(0, 8)}</td>
              <td className={TD}>{planName(o.plan_id)}</td>
              <td className={TD}>
                {formatMoney(o.total, o.currency)}
                {o.discount_amount > 0 && (
                  <span className="ml-1 text-xs text-success">
                    (−{formatMoney(o.discount_amount, o.currency)})
                  </span>
                )}
              </td>
              <td className={`${TD} font-mono text-xs`}>{o.coupon_code ?? '—'}</td>
              <td className={TD}>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    o.status === 'paid'
                      ? 'border-success/30 bg-green-50 text-success'
                      : 'border-line bg-surface-2 text-muted'
                  }`}
                >
                  {o.status}
                </span>
              </td>
              <td className={`${TD} text-muted`}>{fmtDate(o.paid_at ?? o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CouponForm({ onDone }: { onDone: () => void }): ReactNode {
  const plans = usePlans()
  const [code, setCode] = useState('')
  const [type, setType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState('')
  const [planId, setPlanId] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const numValue = Number(value)
    if (!code.trim()) return setError('Code is required.')
    if (!Number.isFinite(numValue) || numValue <= 0) return setError('Value must be a positive number.')
    if (type === 'percent' && numValue > 100) return setError('Percent cannot exceed 100.')
    setBusy(true)
    setError(null)
    try {
      await adminCreateCoupon({
        code: code.trim().toUpperCase(),
        type,
        value: type === 'percent' ? Math.round(numValue) : Math.round(numValue),
        planId: planId || null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-4 rounded-xl border border-line bg-surface p-5">
      <h2 className="font-semibold">Create coupon</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-muted">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SAVE20"
            className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-sm uppercase focus:border-gold focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'percent' | 'fixed')}
            className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-gold focus:outline-none"
          >
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed (minor units)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Value</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            placeholder={type === 'percent' ? '20' : '5000'}
            className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Plan (optional)</span>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-gold focus:outline-none"
          >
            <option value="">Any plan</option>
            {(plans ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Max uses (optional)</span>
          <input
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            inputMode="numeric"
            placeholder="Unlimited"
            className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Expires (optional)</span>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 cursor-pointer rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create coupon'}
      </button>
    </form>
  )
}

function CouponsTab(): ReactNode {
  const planName = usePlanName()
  const [rows, setRows] = useState<AdminCouponRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const load = useCallback((): void => {
    adminCoupons()
      .then((r) => setRows(r.coupons))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  useEffect(load, [load])

  const toggleActive = async (coupon: AdminCouponRow): Promise<void> => {
    try {
      await adminUpdateCoupon(coupon.id, { active: !coupon.active })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const remove = async (coupon: AdminCouponRow): Promise<void> => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return
    try {
      await adminDeleteCoupon(coupon.id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Discount codes applied at checkout (before tax).</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold hover:border-gold hover:text-gold-strong"
        >
          {showForm ? 'Close form' : '+ New coupon'}
        </button>
      </div>
      {showForm && (
        <CouponForm
          onDone={() => {
            setShowForm(false)
            load()
          }}
        />
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {rows === null ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          No coupons yet.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={TH}>Code</th>
                <th className={TH}>Discount</th>
                <th className={TH}>Plan</th>
                <th className={TH}>Uses</th>
                <th className={TH}>Expires</th>
                <th className={TH}>Status</th>
                <th className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line/50 last:border-0">
                  <td className={`${TD} font-mono font-semibold`}>{c.code}</td>
                  <td className={TD}>
                    {c.type === 'percent' ? `${c.value}%` : `${(c.value / 100).toFixed(2)} off`}
                  </td>
                  <td className={`${TD} text-muted`}>{c.plan_id ? planName(c.plan_id) : 'Any'}</td>
                  <td className={TD}>
                    {c.used_count}
                    {c.max_uses ? ` / ${c.max_uses}` : ''}
                  </td>
                  <td className={`${TD} text-muted`}>{fmtDate(c.expires_at)}</td>
                  <td className={TD}>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        c.active
                          ? 'border-success/30 bg-green-50 text-success'
                          : 'border-line bg-surface-2 text-muted'
                      }`}
                    >
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className={TD}>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => void toggleActive(c)}
                        className="cursor-pointer rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:border-gold hover:text-gold-strong"
                      >
                        {c.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => void remove(c)}
                        className="cursor-pointer rounded-md border border-danger/30 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface PlanFormState {
  id: string
  name: string
  blurb: string
  licenseType: 'perpetual' | 'subscription'
  months: string
  priceInr: string
  priceUsd: string
  active: boolean
  sortOrder: string
  highlight: boolean
}

const EMPTY_PLAN: PlanFormState = {
  id: '',
  name: '',
  blurb: '',
  licenseType: 'subscription',
  months: '1',
  priceInr: '',
  priceUsd: '',
  active: true,
  sortOrder: '0',
  highlight: false
}

function rowToForm(row: AdminPlanRow): PlanFormState {
  return {
    id: row.id,
    name: row.name,
    blurb: row.blurb,
    licenseType: row.license_type,
    months: row.months !== null ? String(row.months) : '',
    priceInr: (row.price_inr / 100).toString(),
    priceUsd: (row.price_usd / 100).toString(),
    active: row.active,
    sortOrder: String(row.sort_order),
    highlight: row.highlight
  }
}

function PlanForm({
  editing,
  onDone
}: {
  editing: AdminPlanRow | null
  onDone: () => void
}): ReactNode {
  const [form, setForm] = useState<PlanFormState>(editing ? rowToForm(editing) : EMPTY_PLAN)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof PlanFormState>(key: K, value: PlanFormState[K]): void =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const months = form.licenseType === 'subscription' ? Number(form.months) : null
    const priceInr = Math.round(Number(form.priceInr) * 100)
    const priceUsd = Math.round(Number(form.priceUsd) * 100)
    if (!form.name.trim()) return setError('Name is required.')
    if (form.licenseType === 'subscription' && (!Number.isInteger(months) || (months ?? 0) < 1)) {
      return setError('Subscription plans need months >= 1.')
    }
    if (!Number.isFinite(priceInr) || priceInr < 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
      return setError('Prices must be non-negative numbers.')
    }
    setBusy(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      blurb: form.blurb.trim(),
      licenseType: form.licenseType,
      months,
      priceInr,
      priceUsd,
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
      highlight: form.highlight
    }
    try {
      if (editing) {
        await adminUpdatePlan(editing.id, payload)
      } else {
        await adminCreatePlan({ id: form.id.trim().toLowerCase(), ...payload })
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const input =
    'mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-gold focus:outline-none'

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-4 rounded-xl border border-line bg-surface p-5">
      <h2 className="font-semibold">{editing ? `Edit plan: ${editing.id}` : 'Create plan'}</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-muted">ID (slug)</span>
          <input
            value={form.id}
            onChange={(e) => set('id', e.target.value.toLowerCase())}
            disabled={Boolean(editing)}
            placeholder="yearly"
            className={`${input} font-mono disabled:opacity-60`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Name</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Type</span>
          <select
            value={form.licenseType}
            onChange={(e) => set('licenseType', e.target.value as PlanFormState['licenseType'])}
            className={input}
          >
            <option value="subscription">Subscription</option>
            <option value="perpetual">Perpetual (lifetime)</option>
          </select>
        </label>
        {form.licenseType === 'subscription' && (
          <label className="block">
            <span className="text-xs font-medium text-muted">Months per period</span>
            <input
              value={form.months}
              onChange={(e) => set('months', e.target.value)}
              inputMode="numeric"
              className={input}
            />
          </label>
        )}
        <label className="block">
          <span className="text-xs font-medium text-muted">Price ₹ (before GST)</span>
          <input
            value={form.priceInr}
            onChange={(e) => set('priceInr', e.target.value)}
            inputMode="decimal"
            placeholder="1099"
            className={input}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Price $</span>
          <input
            value={form.priceUsd}
            onChange={(e) => set('priceUsd', e.target.value)}
            inputMode="decimal"
            placeholder="14"
            className={input}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Sort order</span>
          <input
            value={form.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
            inputMode="numeric"
            className={input}
          />
        </label>
        <label className="col-span-full block sm:col-span-2">
          <span className="text-xs font-medium text-muted">Blurb</span>
          <input value={form.blurb} onChange={(e) => set('blurb', e.target.value)} className={input} />
        </label>
        <div className="flex items-end gap-5 pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
              className="cursor-pointer"
            />
            Active (for sale)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.highlight}
              onChange={(e) => set('highlight', e.target.checked)}
              className="cursor-pointer"
            />
            Highlight
          </label>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50"
        >
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create plan'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-gold hover:text-gold-strong"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function PlansTab(): ReactNode {
  const [rows, setRows] = useState<AdminPlanRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminPlanRow | null>(null)

  const load = useCallback((): void => {
    adminPlans()
      .then((r) => setRows(r.plans))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  useEffect(load, [load])

  const toggleActive = async (plan: AdminPlanRow): Promise<void> => {
    try {
      await adminUpdatePlan(plan.id, { active: !plan.active })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const remove = async (plan: AdminPlanRow): Promise<void> => {
    if (!window.confirm(`Delete plan "${plan.name}" (${plan.id})? Existing orders keep showing the raw id.`)) {
      return
    }
    try {
      await adminDeletePlan(plan.id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const closeForm = (): void => {
    setShowForm(false)
    setEditing(null)
    load()
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Plans shown on the pricing page and sold at checkout. Prices are before GST.
        </p>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm((v) => !v)
          }}
          className="cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold hover:border-gold hover:text-gold-strong"
        >
          {showForm || editing ? 'Close form' : '+ New plan'}
        </button>
      </div>
      {(showForm || editing) && <PlanForm editing={editing} onDone={closeForm} />}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {rows === null ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          No plans yet.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={TH}>ID</th>
                <th className={TH}>Name</th>
                <th className={TH}>Type</th>
                <th className={TH}>₹ (INR)</th>
                <th className={TH}>$ (USD)</th>
                <th className={TH}>Sort</th>
                <th className={TH}>Status</th>
                <th className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line/50 last:border-0">
                  <td className={`${TD} font-mono text-xs`}>{p.id}</td>
                  <td className={TD}>
                    <span className="font-medium">{p.name}</span>
                    {p.highlight && (
                      <span className="ml-2 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold-strong">
                        Popular
                      </span>
                    )}
                  </td>
                  <td className={`${TD} text-muted`}>
                    {p.license_type === 'perpetual' ? 'Lifetime' : `${p.months} mo`}
                  </td>
                  <td className={TD}>{formatMoney(p.price_inr, 'INR')}</td>
                  <td className={TD}>{formatMoney(p.price_usd, 'USD')}</td>
                  <td className={`${TD} text-muted`}>{p.sort_order}</td>
                  <td className={TD}>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        p.active
                          ? 'border-success/30 bg-green-50 text-success'
                          : 'border-line bg-surface-2 text-muted'
                      }`}
                    >
                      {p.active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className={TD}>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setEditing(p)
                          setShowForm(true)
                        }}
                        className="cursor-pointer rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:border-gold hover:text-gold-strong"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void toggleActive(p)}
                        className="cursor-pointer rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:border-gold hover:text-gold-strong"
                      >
                        {p.active ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => void remove(p)}
                        className="cursor-pointer rounded-md border border-danger/30 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function Admin(): ReactNode {
  const { session, loading } = useSession()
  const [tab, setTab] = useState<Tab>('users')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session) {
      setIsAdmin(false)
      return
    }
    let alive = true
    void (async (): Promise<void> => {
      try {
        const { data } = await supabase()
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()
        if (alive) setIsAdmin(Boolean((data as { is_admin?: boolean } | null)?.is_admin))
      } catch {
        if (alive) setIsAdmin(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [session])

  if (loading) return <div className="py-24 text-center text-sm text-muted">Loading…</div>
  if (!session) return <Navigate to="/auth?next=/admin" replace />
  if (isAdmin === null) return <div className="py-24 text-center text-sm text-muted">Checking permissions…</div>
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted">Your account does not have admin privileges.</p>
        <Link
          to="/account"
          className="mt-4 inline-block rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-gold hover:text-gold-strong"
        >
          Back to account
        </Link>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'plans', label: 'Plans' },
    { id: 'users', label: 'Users' },
    { id: 'licenses', label: 'Licenses' },
    { id: 'orders', label: 'Orders' },
    { id: 'coupons', label: 'Coupons' }
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted">Manage users, licenses, orders and coupons.</p>
        </div>
        <Link
          to="/account"
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold-strong"
        >
          Back to account
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-5 gap-1 rounded-lg bg-surface-2 p-1 text-sm font-medium">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`cursor-pointer rounded-md py-2 ${tab === t.id ? 'bg-surface shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans' && <PlansTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'licenses' && <LicensesTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'coupons' && <CouponsTab />}
    </div>
  )
}
