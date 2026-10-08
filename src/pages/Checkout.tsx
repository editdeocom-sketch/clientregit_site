import { useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useCurrency } from '@/lib/currency'
import { useSession } from '@/lib/auth'
import { createOrder, verifyPayment } from '@/lib/api'
import { openCheckout } from '@/lib/razorpay'
import { formatMoney, isPlanId, PLANS, quote } from '@shared/plans'

export function Checkout(): ReactNode {
  const { planId } = useParams()
  const { currency } = useCurrency()
  const { session, loading } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!planId || !isPlanId(planId)) return <Navigate to="/" replace />
  if (loading) {
    return <div className="py-24 text-center text-sm text-muted">Loading…</div>
  }
  if (!session) {
    return <Navigate to={`/auth?next=/checkout/${planId}`} replace />
  }

  const plan = PLANS[planId]
  const price = quote(planId, currency)

  const pay = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const order = await createOrder(planId, currency)
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

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <Link to="/#pricing" className="text-sm text-muted hover:text-ink">
        ← Back to pricing
      </Link>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-7 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as <span className="font-medium text-ink">{session.user.email}</span>
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-line bg-canvas p-5 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{plan.name} plan</span>
            <span className="font-medium">{formatMoney(price.subtotal, currency)}</span>
          </div>
          {price.taxPercent > 0 && (
            <>
              <div className="flex items-center justify-between text-muted">
                <span>GST @ {price.taxPercent}%</span>
                <span>{formatMoney(price.tax, currency)}</span>
              </div>
              <div className="text-xs text-muted">CGST 9% + SGST 9%, shown on your invoice</div>
            </>
          )}
          <div className="flex items-center justify-between border-t border-line pt-3 text-base font-bold">
            <span>Total</span>
            <span>{formatMoney(price.total, currency)}</span>
          </div>
        </div>

        <ul className="mt-5 space-y-1.5 text-sm text-muted">
          <li>
            ✓ {plan.licenseType === 'perpetual'
              ? 'Lifetime license — never expires'
              : `Active ${plan.months === 1 ? 'for one month' : `for ${plan.months} months`}, renews automatically`}
          </li>
          <li>✓ License key appears in your account immediately after payment</li>
          <li>✓ 14-day refunds — email support</li>
        </ul>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          onClick={() => void pay()}
          disabled={busy}
          className="mt-6 w-full cursor-pointer rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50"
        >
          {busy ? 'Opening payment…' : `Pay ${formatMoney(price.total, currency)}`}
        </button>

        <p className="mt-3 text-center text-xs text-muted">
          Payments are processed securely by Razorpay.
        </p>
      </div>
    </div>
  )
}
