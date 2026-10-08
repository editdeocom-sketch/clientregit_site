import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '@/lib/currency'
import { formatMoney, PLANS, PLAN_ORDER, quote } from '@shared/plans'
import { SITE } from '@shared/site'

const FEATURES: Array<{ title: string; body: string }> = [
  { title: 'Client profiles', body: 'Every client with contacts, notes and rates — search instantly, archive when done.' },
  { title: 'Projects & deadlines', body: 'Track enquiries to delivery with clear statuses, quotes and deadlines that never get lost.' },
  { title: 'Invoices that just work', body: 'Create, preview and print GST-ready invoices from your own business details in seconds.' },
  { title: 'Tasks & files', body: 'To-dos per project and links to the folders you already use on disk.' },
  { title: 'Calendar & reports', body: 'See upcoming deadlines and monthly revenue at a glance.' },
  { title: 'Your data stays yours', body: 'A desktop app that stores everything locally on your PC — export a backup anytime.' }
]

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — every install gets a full 7-day trial with all features. No card needed. After the trial, sign in with your account and license key to keep using the app.'
  },
  {
    q: 'How does activation work?',
    a: 'Buy a plan here, sign in to your account, and copy your license key (CRIT-…). Open ClientRegit → sign in with the same email and paste the key. Lifetime plans never expire.'
  },
  {
    q: 'Do you charge GST?',
    a: 'Prices shown for India are before GST — 18% GST is added at checkout and shown on your invoice with our GSTIN. Customers outside India pay in USD with no GST.'
  },
  {
    q: 'Can I use one license on multiple computers?',
    a: 'A license activates the account on your machines — sign in on each. Need more seats for a team? Email support.'
  },
  {
    q: 'Refunds?',
    a: 'If ClientRegit is not a fit, email support within 14 days of purchase for a full refund.'
  }
]

export function Landing(): ReactNode {
  const { currency } = useCurrency()

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center">
        <p className="mb-4 inline-block rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold-strong">
          Built for freelance video editors
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
          Run your video business, not a spreadsheet
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          {SITE.name} keeps your clients, projects, deadlines and invoices in one fast desktop app —
          and your data stays on your computer.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/downloads/ClientRegit-Setup-1.0.0.exe"
            className="rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-white hover:bg-gold-strong"
          >
            Download for Windows
          </a>
          <button
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            className="cursor-pointer rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold hover:border-gold hover:text-gold-strong"
          >
            See pricing
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">7-day free trial · No credit card required</p>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-line bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Everything a freelance studio needs</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-line bg-canvas p-5">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Simple pricing</h2>
          <p className="mt-2 text-center text-sm text-muted">
            {currency === 'INR'
              ? 'Prices before GST — 18% GST added at checkout'
              : 'USD pricing for customers outside India'}
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS[planId]
              const price = quote(planId, currency)
              const highlight = planId === 'yearly'
              return (
                <div
                  key={planId}
                  className={`relative rounded-2xl border p-6 ${
                    highlight ? 'border-gold bg-gold/5 shadow-lg' : 'border-line bg-surface'
                  }`}
                >
                  {highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="mt-1 min-h-10 text-sm text-muted">{plan.blurb}</p>
                  <p className="mt-4 text-4xl font-extrabold tracking-tight">
                    {formatMoney(price.subtotal, currency)}
                    <span className="text-base font-medium text-muted">
                      {planId === 'monthly' ? ' /month' : planId === 'yearly' ? ' /year' : ''}
                    </span>
                  </p>
                  {currency === 'INR' && (
                    <p className="mt-1 text-xs text-muted">+ 18% GST ({formatMoney(price.tax, currency)})</p>
                  )}
                  <ul className="mt-5 space-y-2 text-sm">
                    <li>✓ All features, all updates</li>
                    <li>✓ {plan.licenseType === 'perpetual' ? 'Lifetime license' : `Renews every ${plan.months} month${plan.months === 1 ? '' : 's'}`}</li>
                    <li>✓ Email support</li>
                  </ul>
                  <Link
                    to={`/checkout/${plan.id}`}
                    className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                      highlight
                        ? 'bg-gold text-white hover:bg-gold-strong'
                        : 'border border-line bg-surface hover:border-gold hover:text-gold-strong'
                    }`}
                  >
                    Buy {plan.name}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-line bg-surface py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Questions</h2>
          <div className="mt-8 space-y-4">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-xl border border-line bg-canvas p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  {item.q}
                  <span className="float-right text-gold group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight">Try it free for 7 days</h2>
          <p className="mt-2 text-muted">Download the app, explore everything, then activate.</p>
          <a
            href="/downloads/ClientRegit-Setup-1.0.0.exe"
            className="mt-6 inline-block rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-white hover:bg-gold-strong"
          >
            Download for Windows
          </a>
        </div>
      </section>
    </div>
  )
}
