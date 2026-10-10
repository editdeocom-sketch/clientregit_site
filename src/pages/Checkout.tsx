import { useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCurrency } from '@/lib/currency'
import { useSession } from '@/lib/auth'
import { usePlans, planById } from '@/lib/plans'
import { createOrder, validateCoupon, verifyPayment } from '@/lib/api'
import { openCheckout } from '@/lib/razorpay'
import { formatMoney, quotePlan } from '@shared/plans'

interface AppliedCoupon {
  code: string
  type: 'percent' | 'fixed'
  value: number
  discountAmount: number
}

export function Checkout(): ReactNode {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currency } = useCurrency()
  const { session, loading } = useSession()
  const plans = usePlans()
  const seatAddonMode = searchParams.get('mode') === 'seat_addon'
  const initialQty = Math.max(1, Math.min(50, Number(searchParams.get('qty')) || 1))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponInput, setCouponInput] = useState('')
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [extraSeats, setExtraSeats] = useState(seatAddonMode ? initialQty : 0)

  if (loading || plans === null) {
    return <div className="py-24 text-center text-sm text-muted">Loading…</div>
  }
  if (!session) {
    return <Navigate to={`/auth?next=/checkout/${planId ?? ''}${seatAddonMode ? '?mode=seat_addon' : ''}`} replace />
  }

  const plan = planById(plans, planId)
  if (!plan || !plan.active) return <Navigate to="/" replace />

  const isTeam = plan.seats > 1
  if (!isTeam && (seatAddonMode || extraSeats > 0)) {
    return <Navigate to={`/checkout/${plan.id}`} replace />
  }

  const price = quotePlan(plan, currency, seatAddonMode ? 0 : extraSeats)
  const addonOnly = seatAddonMode
    ? quotePlan(plan, currency, extraSeats).subtotal - quotePlan(plan, currency, 0).subtotal
    : 0
  const displaySubtotal = seatAddonMode ? addonOnly : price.subtotal
  const taxPercent = price.taxPercent
  const discount = applied?.discountAmount ?? 0
  const discountedSubtotal = Math.max(0, displaySubtotal - discount)
  const tax = Math.round((discountedSubtotal * taxPercent) / 100)
  const total = discountedSubtotal + tax
  const totalSeats = plan.seats + extraSeats

  const applyCoupon = async (): Promise<void> => {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    setCouponBusy(true)
    setCouponError(null)
    try {
      const result = await validateCoupon(code, plan.id, currency)
      setApplied({
        code: result.code,
        type: result.type,
        value: result.value,
        discountAmount: result.discountAmount
      })
    } catch (err) {
      setApplied(null)
      setCouponError(err instanceof Error ? err.message : String(err))
    } finally {
      setCouponBusy(false)
    }
  }

  const removeCoupon = (): void => {
    setApplied(null)
    setCouponInput('')
    setCouponError(null)
  }

  const pay = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const order = await createOrder(plan.id, currency, applied?.code, {
        extraSeats,
        mode: seatAddonMode ? 'seat_addon' : 'plan'
      })
      if (order.mock) {
        await verifyPayment(order.orderId, `pay_mock_${Date.now()}`, 'mock_signature')
        window.location.hash = '/account?paid=1'
        return
      }
      await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        email: session.user.email ?? '',
        onSuccess: (response) => {
          verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature)
            .then(() => {
              window.location.hash = '/account?paid=1'
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : String(err))
              setBusy(false)
            })
        },
        onFailure: (message) => {
          setError(message)
          setBusy(false)
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const perSeat = plan.pricePerSeat[currency]

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <button
        type="button"
        onClick={() => {
          navigate('/')
          setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 80)
        }}
        className="cursor-pointer text-sm text-muted hover:text-ink"
      >
        ← Back to pricing
      </button>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-7 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">{seatAddonMode ? 'Add team members' : 'Checkout'}</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as <span className="font-medium text-ink">{session.user.email}</span>
        </p>

        {isTeam && perSeat > 0 && (
          <div className="mt-5 rounded-xl border border-line bg-canvas p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {seatAddonMode ? `Extra members for ${plan.name}` : `Additional members (beyond ${plan.seats})`}
                </p>
                <p className="text-xs text-muted">
                  {formatMoney(perSeat, currency)} each, one-time · activates on more computers
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Fewer members"
                  onClick={() => setExtraSeats((n) => Math.max(seatAddonMode ? 1 : 0, n - 1))}
                  className="h-8 w-8 cursor-pointer rounded-lg border border-line bg-surface text-sm font-bold hover:border-gold"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-bold" aria-live="polite">
                  {extraSeats}
                </span>
                <button
                  type="button"
                  aria-label="More members"
                  onClick={() => setExtraSeats((n) => Math.min(50, n + 1))}
                  className="h-8 w-8 cursor-pointer rounded-lg border border-line bg-surface text-sm font-bold hover:border-gold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-3 rounded-xl border border-line bg-canvas p-5 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{seatAddonMode ? `${plan.name} — extra members` : `${plan.name} plan`}</span>
            <span className="font-medium">{formatMoney(displaySubtotal, currency)}</span>
          </div>
          {isTeam && (
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Seats included</span>
              <span>
                {seatAddonMode ? `+${extraSeats} (now ${totalSeats} total)` : `${plan.seats}${extraSeats > 0 ? ` + ${extraSeats} extra = ${totalSeats}` : ''}`}
              </span>
            </div>
          )}
          {extraSeats > 0 && !seatAddonMode && (
            <div className="flex items-center justify-between text-muted">
              <span>
                Extra members × {extraSeats}
              </span>
              <span>{formatMoney(price.extraSeatsAmount, currency)}</span>
            </div>
          )}
          {discount > 0 && (
            <>
              <div className="flex items-center justify-between text-success">
                <span>
                  Coupon <span className="font-mono font-semibold">{applied?.code}</span>
                </span>
                <span>−{formatMoney(discount, currency)}</span>
              </div>
              {taxPercent > 0 && <div className="text-xs text-muted">GST is calculated on the discounted price.</div>}
            </>
          )}
          {taxPercent > 0 && (
            <>
              <div className="flex items-center justify-between text-muted">
                <span>GST @ {taxPercent}%</span>
                <span>{formatMoney(tax, currency)}</span>
              </div>
              <div className="text-xs text-muted">CGST 9% + SGST 9%, shown on your invoice</div>
            </>
          )}
          <div className="flex items-center justify-between border-t border-line pt-3 text-base font-bold">
            <span>Total</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
        </div>

        {!applied ? (
          <div className="mt-4 flex items-end gap-2">
            <label className="flex-1">
              <span className="block text-xs font-medium text-muted">Coupon code</span>
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="SAVE20"
                className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-sm uppercase focus:border-gold focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void applyCoupon()}
              disabled={couponBusy || !couponInput.trim()}
              className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-gold hover:text-gold-strong disabled:opacity-50"
            >
              {couponBusy ? 'Checking…' : 'Apply'}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-success/30 bg-green-50 px-3 py-2 text-sm">
            <span className="text-success">
              Coupon <span className="font-mono font-semibold">{applied.code}</span> applied — you save{' '}
              {formatMoney(discount, currency)}
            </span>
            <button
              type="button"
              onClick={removeCoupon}
              className="cursor-pointer text-xs font-semibold text-muted hover:text-ink"
            >
              Remove
            </button>
          </div>
        )}
        {couponError && <p className="mt-2 text-sm text-danger">{couponError}</p>}

        <ul className="mt-5 space-y-1.5 text-sm text-muted">
          <li>
            ✓{' '}
            {plan.licenseType === 'perpetual'
              ? 'Lifetime license — never expires'
              : `Active for ${plan.months} month${plan.months === 1 ? '' : 's'}, renews automatically`}
          </li>
          {isTeam && (
            <li>
              ✓ One key for up to {totalSeats} computer{totalSeats === 1 ? '' : 's'} (Team plans need internet to
              verify seats)
            </li>
          )}
          <li>✓ License key appears in your account immediately after payment</li>
          <li>✓ 14-day refunds — email support</li>
        </ul>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
        )}

        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy}
          className="mt-6 w-full cursor-pointer rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50"
        >
          {busy ? 'Opening payment…' : `Pay ${formatMoney(total, currency)}`}
        </button>

        <p className="mt-3 text-center text-xs text-muted">Payments are processed securely by Razorpay.</p>
      </div>
    </div>
  )
}
