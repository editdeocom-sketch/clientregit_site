import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '@/lib/currency'
import { usePlans } from '@/lib/plans'
import { formatMoney, quotePlan, savePercent, type SitePlan } from '@shared/plans'
import { useReveal } from '@/lib/useReveal'

type PricingTab = 'individual' | 'team'

function PlanCard({ plan, currency }: { plan: SitePlan; currency: 'INR' | 'USD' }): ReactNode {
  const price = quotePlan(plan, currency)
  const save = savePercent(plan, currency)
  const compare = plan.compareAt[currency]
  const isTeam = plan.seats > 1
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
      className={`relative rounded-2xl border p-6 ${
        plan.highlight ? 'border-gold bg-gold/5 shadow-lg' : 'border-line bg-canvas'
      }`}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">
          Most popular
        </span>
      )}
      {save !== null && (
        <span className="absolute top-4 right-4 rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
          Save {save}%
        </span>
      )}
      <h3 className="text-lg font-bold">{plan.name}</h3>
      <p className="mt-1 min-h-10 pr-16 text-sm text-muted">{plan.blurb}</p>
      <p className="mt-4 text-4xl font-extrabold tracking-tight">
        {formatMoney(price.subtotal, currency)}
        <span className="text-base font-medium text-muted">{period}</span>
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        {compare !== null && compare > price.subtotal && (
          <span className="line-through">{formatMoney(compare, currency)}</span>
        )}
        {currency === 'INR' && <span>+ 18% GST ({formatMoney(price.tax, currency)})</span>}
      </div>
      <ul className="mt-5 space-y-2 text-sm">
        <li>✓ All features, all updates</li>
        {isTeam && <li>✓ Up to {plan.seats} members</li>}
        <li>
          ✓{' '}
          {plan.licenseType === 'perpetual'
            ? 'Lifetime license'
            : `Renews every ${plan.months} month${plan.months === 1 ? '' : 's'}`}
        </li>
        {isTeam && plan.pricePerSeat[currency] > 0 && (
          <li className="text-muted">
            +1 member: {formatMoney(plan.pricePerSeat[currency], currency)} one-time
          </li>
        )}
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
}

export function PricingSection(): ReactNode {
  const { currency } = useCurrency()
  const plans = usePlans()
  const [tab, setTab] = useState<PricingTab>('individual')
  const r = useReveal<HTMLDivElement>()

  const visible =
    plans === null
      ? null
      : plans.filter((plan) => plan.active && (tab === 'individual' ? plan.seats <= 1 : plan.seats > 1))

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

          <div className="mx-auto mt-8 inline-flex rounded-xl border border-line bg-surface-2 p-1 text-sm font-semibold">
            {(
              [
                ['individual', 'Individual'],
                ['team', 'Team']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={`cursor-pointer rounded-lg px-5 py-2 transition-colors ${
                  tab === id ? 'bg-ink text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'team' && (
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
              One license key for the whole crew — activate on up to N computers. Extra members ₹299 / $5 each.
            </p>
          )}
        </div>

        <div ref={r.ref} className={`mt-10 grid gap-5 md:grid-cols-3 ${r.className}`}>
          {visible === null ? (
            <p className="col-span-full py-8 text-center text-sm text-muted">Loading plans…</p>
          ) : visible.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-muted">No plans in this category.</p>
          ) : (
            visible.map((plan) => <PlanCard key={plan.id} plan={plan} currency={currency} />)
          )}
        </div>
        <p className="mt-8 text-center text-xs text-muted">
          Not a fit? Email support within 14 days of purchase for a full refund.
        </p>
      </div>
    </section>
  )
}
