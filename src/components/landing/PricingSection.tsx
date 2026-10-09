import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '@/lib/currency'
import { usePlans } from '@/lib/plans'
import { formatMoney, quotePlan } from '@shared/plans'
import { useReveal } from '@/lib/useReveal'

export function PricingSection(): ReactNode {
  const { currency } = useCurrency()
  const plans = usePlans()
  const r = useReveal<HTMLDivElement>()

  return (
    <section id="pricing" className="border-b border-line bg-surface py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Simple pricing</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Take a lifetime license or a cancel-anytime subscription. Every download starts with a 7-day free trial —
            no card needed.
            {currency === 'INR'
              ? ' Prices below are before GST — 18% GST is added at checkout.'
              : ' USD pricing for customers outside India.'}
          </p>
        </div>
        <div ref={r.ref} className={`mt-12 grid gap-5 md:grid-cols-3 ${r.className}`}>
          {plans === null ? (
            <p className="col-span-full py-8 text-center text-sm text-muted">Loading plans…</p>
          ) : (
            plans
              .filter((plan) => plan.active)
              .map((plan) => {
                const price = quotePlan(plan, currency)
                const period =
                  plan.licenseType === 'perpetual'
                    ? ''
                    : plan.months === 1
                      ? ' /month'
                      : plan.months === 12
                        ? ' /year'
                        : ` /${plan.months} mo`
                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border p-6 ${
                      plan.highlight ? 'border-gold bg-gold/5 shadow-lg' : 'border-line bg-canvas'
                    }`}
                  >
                    {plan.highlight && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">
                        Most popular
                      </span>
                    )}
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="mt-1 min-h-10 text-sm text-muted">{plan.blurb}</p>
                    <p className="mt-4 text-4xl font-extrabold tracking-tight">
                      {formatMoney(price.subtotal, currency)}
                      <span className="text-base font-medium text-muted">{period}</span>
                    </p>
                    {currency === 'INR' && (
                      <p className="mt-1 text-xs text-muted">+ 18% GST ({formatMoney(price.tax, currency)})</p>
                    )}
                    <ul className="mt-5 space-y-2 text-sm">
                      <li>✓ All features, all updates</li>
                      <li>
                        ✓{' '}
                        {plan.licenseType === 'perpetual'
                          ? 'Lifetime license'
                          : `Renews every ${plan.months} month${plan.months === 1 ? '' : 's'}`}
                      </li>
                      <li>✓ Email support</li>
                    </ul>
                    <Link
                      to={`/checkout/${plan.id}`}
                      className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                        plan.highlight
                          ? 'bg-gold text-white hover:bg-gold-strong'
                          : 'border border-line bg-surface hover:border-gold hover:text-gold-strong'
                      }`}
                    >
                      Buy {plan.name}
                    </Link>
                  </div>
                )
              })
          )}
        </div>
        <p className="mt-8 text-center text-xs text-muted">
          Not a fit? Email support within 14 days of purchase for a full refund.
        </p>
      </div>
    </section>
  )
}
