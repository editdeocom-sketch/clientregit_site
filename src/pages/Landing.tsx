import type { ReactNode } from 'react'
import { Hero } from '@/components/landing/Hero'
import { Benefits } from '@/components/landing/Benefits'
import { Problem } from '@/components/landing/Problem'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Demo } from '@/components/landing/Demo'
import { WhoItsFor } from '@/components/landing/WhoItsFor'
import { PricingSection } from '@/components/landing/PricingSection'
import { Trust } from '@/components/landing/Trust'
import { FinalCta } from '@/components/landing/FinalCta'

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — every install gets a full 7-day trial with all features. No card needed. After the trial, sign in with your account and license key to keep using the app.'
  },
  {
    q: 'Which platforms are supported?',
    a: 'Windows 10/11 (64-bit) and macOS on Apple Silicon (M1 or newer). Intel-based Macs are not supported at the moment.'
  },
  {
    q: 'How does activation work?',
    a: 'Buy a plan here, sign in to your account, and copy your license key (CRIT-…). Open ClientRegit → sign in with the same email and paste the key. Lifetime plans never expire.'
  },
  {
    q: 'Do you charge GST?',
    a: 'Prices shown for India are before GST — 18% GST is added at checkout and shown on your invoice. Customers outside India pay in USD with no GST.'
  },
  {
    q: 'Can I use one license on multiple computers?',
    a: 'Individual plans cover one computer. Team plans come with seats — one key works on up to 5, 8 or 10 machines. Need more members? Add seats from your account for ₹299 / $5 each, and they stay added for good.'
  },
  {
    q: 'Do Team plans need internet?',
    a: 'Yes — Team keys verify seats online every time the app opens, so each machine checks it still has a free seat. Individual keys work fully offline after activation.'
  },
  {
    q: 'Where is my data stored?',
    a: 'In a local database on your own computer. ClientRegit is a desktop app — your client and project data is never uploaded to our servers. You can export a JSON backup or CSV at any time.'
  },
  {
    q: 'Does it work offline?',
    a: 'Yes. The app itself runs fully offline. Internet is only needed for sign-in, license activation, purchase and app updates.'
  },
  {
    q: 'How do revisions work?',
    a: 'Projects have a dedicated revision status plus notes, so you always know where each job stands. Detailed timestamped video feedback is not built in — keep that in your editing tool.'
  },
  {
    q: 'What do I get with a plan?',
    a: 'Everything: clients, projects, tasks, files, invoices, calendar, reports and every future update. There are no feature tiers.'
  },
  {
    q: 'Refunds?',
    a: 'If ClientRegit is not a fit, email support within 14 days of purchase for a full refund.'
  },
  {
    q: 'Where do I find my license key after purchase?',
    a: 'Sign in to your account on this site and open the Licenses tab — your key appears there the moment payment succeeds.'
  }
]

export function Landing(): ReactNode {
  return (
    <div>
      <Hero />
      <Benefits />
      <Problem />
      <Features />
      <HowItWorks />
      <Demo />
      <WhoItsFor />
      <PricingSection />
      <Trust />

      <section id="faq" className="border-b border-line bg-surface-2 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Questions</h2>
          <div className="mt-10 space-y-4">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-xl border border-line bg-surface p-5">
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

      <FinalCta />
    </div>
  )
}
