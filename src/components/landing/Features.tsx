import type { ReactNode } from 'react'
import { useReveal } from '@/lib/useReveal'
import { ShotFrame } from './ShotFrame'

const ROWS: Array<{
  title: string
  body: string
  bullets: string[]
  src?: string
  alt?: string
  label?: string
}> = [
  {
    title: 'Client management',
    body: 'Every client with the details you actually use — no more digging through chat threads.',
    bullets: ['Contacts, emails and phone numbers', 'Notes and tags per client', 'Archive instead of delete', 'Lifetime invoiced total at a glance'],
    src: '/shots/clients.webp',
    alt: 'ClientRegit client list with search, tags and lifetime totals',
    label: 'Clients'
  },
  {
    title: 'Projects, tasks & files',
    body: 'A clear pipeline from enquiry to delivery, with the tasks and file paths that live next to each job.',
    bullets: ['Statuses: enquiry, in progress, review, revision, delivered, cancelled', 'Priority, deadline and quoted amount on every project', 'To-do lists per project', 'Links to your project folders on disk'],
    src: '/shots/project.webp',
    alt: 'ClientRegit project view with status, tasks and linked project files',
    label: 'Project'
  },
  {
    title: 'Invoices & payments',
    body: 'Build a clean invoice from your business details in seconds — GST-ready for Indian customers.',
    bullets: ['Line items, quantities and rates', 'Tax percentage and discounts calculated for you', 'Payment ledger per invoice', 'Print or save as PDF'],
    src: '/shots/invoice.webp',
    alt: 'ClientRegit invoice editor with line items, 18% GST and payment recording',
    label: 'Invoice'
  },
  {
    title: 'Calendar',
    body: 'Project deadlines on one calendar — see the crunch weeks before they hit.',
    bullets: ['Deadlines from every project', 'Colour-coded by status', 'Jump straight to the project'],
    src: '/shots/calendar.webp',
    alt: 'ClientRegit calendar showing project deadlines for the month',
    label: 'Calendar'
  },
  {
    title: 'Reports',
    body: 'Monthly revenue and project stats so you know if the business is actually growing.',
    bullets: ['Revenue by month', 'Project counts by status', 'No spreadsheet exports needed'],
    src: '/shots/reports.webp',
    alt: 'ClientRegit reports page with monthly revenue charts and project stats',
    label: 'Reports'
  },
  {
    title: 'Google Meet integration',
    body: 'Link your Google account once and run client meetings on Google Meet — create a meeting in one click and copy the link for your client.',
    bullets: [
      'One-click meetings using your own Google account',
      'Upcoming meetings list with join links',
      'Works with the Google Calendar you already use',
      'Tokens stored encrypted on your PC — data goes to Google, not us'
    ]
  },
  {
    title: 'Desktop notifications & tray',
    body: 'Close the window and ClientRegit keeps running in the tray — the alerts you care about keep arriving.',
    bullets: [
      'Task deadlines, assignments and reminders',
      'Team activity and roster alerts',
      'Per-category toggles — pick what deserves your attention',
      'Quitting is a choice, not an accident'
    ],
    src: '/shots/notifications.webp',
    alt: 'ClientRegit notification settings with per-category toggles',
    label: 'Notifications'
  }
]

function FeatureRow({ row, flipped }: { row: (typeof ROWS)[number]; flipped: boolean }): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <div
      ref={r.ref}
      className={`flex flex-col items-center gap-10 md:flex-row md:gap-14 ${flipped ? 'md:flex-row-reverse' : ''} ${r.className}`}
    >
      {row.src && (
        <div className="w-full md:w-1/2">
          <ShotFrame src={row.src} alt={row.alt ?? row.title} label={row.label ?? row.title} />
        </div>
      )}
      <div className={row.src ? 'w-full md:w-1/2' : 'w-full max-w-2xl text-center'}>
        <h3 className="text-2xl font-bold tracking-tight">{row.title}</h3>
        <p className="mt-3 leading-relaxed text-muted">{row.body}</p>
        <ul className={`mt-5 space-y-2.5 text-sm ${row.src ? '' : 'inline-block text-left'}`}>
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
            Real screens from the app — no mockups, no vaporware. Every feature below ships in version 1.3.0.
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
        ClientRegit stores your business data — clients, projects, invoices — in a local database on your computer.
        Sign in with your account to sync it across your computers; team workspaces (if you use one) and the optional
        Google account link also go online. Export a JSON backup or CSV anytime, and keep the files however you like.
      </p>
    </div>
  )
}
