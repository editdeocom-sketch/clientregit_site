import type { ReactNode } from 'react'
import { useReveal } from '@/lib/useReveal'
import { ShotFrame } from './ShotFrame'

const ROWS: Array<{
  title: string
  body: string
  bullets: string[]
  src: string
  alt: string
  label: string
}> = [
  {
    title: 'Client management',
    body: 'Every client with the details you actually use — no more digging through chat threads.',
    bullets: ['Contacts, emails and phone numbers', 'Notes and tags per client', 'Archive instead of delete', 'Lifetime invoiced total at a glance'],
    src: '/shots/clients.png',
    alt: 'ClientRegit client list with search, tags and lifetime totals',
    label: 'Clients'
  },
  {
    title: 'Projects, tasks & files',
    body: 'A clear pipeline from enquiry to delivery, with the tasks and file paths that live next to each job.',
    bullets: ['Statuses: enquiry, in progress, review, revision, delivered, cancelled', 'Priority, deadline and quoted amount on every project', 'To-do lists per project', 'Links to your project folders on disk'],
    src: '/shots/project.png',
    alt: 'ClientRegit project view with status, tasks and linked project files',
    label: 'Project'
  },
  {
    title: 'Invoices & payments',
    body: 'Build a clean invoice from your business details in seconds — GST-ready for Indian customers.',
    bullets: ['Line items, quantities and rates', 'Tax percentage and discounts calculated for you', 'Payment ledger per invoice', 'Print or save as PDF'],
    src: '/shots/invoice.png',
    alt: 'ClientRegit invoice editor with line items, 18% GST and payment recording',
    label: 'Invoice'
  },
  {
    title: 'Calendar',
    body: 'Project deadlines on one calendar — see the crunch weeks before they hit.',
    bullets: ['Deadlines from every project', 'Colour-coded by status', 'Jump straight to the project'],
    src: '/shots/calendar.png',
    alt: 'ClientRegit calendar showing project deadlines for the month',
    label: 'Calendar'
  },
  {
    title: 'Reports',
    body: 'Monthly revenue and project stats so you know if the business is actually growing.',
    bullets: ['Revenue by month', 'Project counts by status', 'No spreadsheet exports needed'],
    src: '/shots/reports.png',
    alt: 'ClientRegit reports page with monthly revenue charts and project stats',
    label: 'Reports'
  }
]

function FeatureRow({ row, flipped }: { row: (typeof ROWS)[number]; flipped: boolean }): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <div
      ref={r.ref}
      className={`flex flex-col items-center gap-10 md:flex-row md:gap-14 ${flipped ? 'md:flex-row-reverse' : ''} ${r.className}`}
    >
      <div className="w-full md:w-1/2">
        <ShotFrame src={row.src} alt={row.alt} label={row.label} />
      </div>
      <div className="w-full md:w-1/2">
        <h3 className="text-2xl font-bold tracking-tight">{row.title}</h3>
        <p className="mt-3 leading-relaxed text-muted">{row.body}</p>
        <ul className="mt-5 space-y-2.5 text-sm">
          {row.bullets.map((b) => (
            <li key={b} className="flex gap-2.5">
              <span className="mt-0.5 font-bold text-gold" aria-hidden>
                ✓
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function Features(): ReactNode {
  return (
    <section id="features" className="border-b border-line bg-canvas py-20">
      <div className="mx-auto max-w-6xl space-y-20 px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Everything a creative business needs</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Real screens from the app — no mockups, no vaporware. Every feature below ships in version 1.0.1.
          </p>
        </div>
        {ROWS.map((row, i) => (
          <FeatureRow key={row.title} row={row} flipped={i % 2 === 1} />
        ))}
        <DataLocalCard />
      </div>
    </section>
  )
}

function DataLocalCard(): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <div ref={r.ref} className={`rounded-2xl border border-line bg-surface p-8 text-center ${r.className}`}>
      <h3 className="text-xl font-bold">Your data stays yours</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        ClientRegit stores everything in a local database on your computer. Nothing is uploaded to our servers.
        Export a JSON backup or CSV anytime, and keep the files however you like.
      </p>
    </div>
  )
}
