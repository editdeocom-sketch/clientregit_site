import type { ReactNode } from 'react'
import { useReveal } from '@/lib/useReveal'

const BENEFITS: Array<{ title: string; body: string }> = [
  { title: 'Client database', body: 'Contacts, notes, tags and lifetime totals — searchable in a second.' },
  { title: 'Project pipeline', body: 'Enquiry to delivered, with priorities, quotes and deadlines in one view.' },
  { title: 'Tasks & files', body: 'To-dos per project plus links to the folders you already use on disk.' },
  { title: 'Tax-ready invoices', body: 'Line items, tax, discounts, payment history — print or PDF.' },
  { title: 'Calendar & reports', body: 'Upcoming deadlines and monthly revenue without opening a spreadsheet.' },
  { title: 'Runs on your PC', body: 'A true desktop app. Your business data stays local, with account sync and JSON backup.' }
]

export function Benefits(): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <section className="border-b border-line bg-canvas py-14">
      <div ref={r.ref} className={`mx-auto max-w-6xl px-4 ${r.className}`}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border border-line bg-surface p-5">
              <h2 className="font-semibold">{b.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
