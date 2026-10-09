import type { ReactNode } from 'react'
import { useReveal } from '@/lib/useReveal'

const SCATTERED = [
  'WhatsApp threads',
  'Drive folders',
  'Deadline spreadsheets',
  'Notes app',
  'A separate invoicing tool'
]

export function Problem(): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <section className="border-b border-line bg-surface-2 py-20">
      <div ref={r.ref} className={`mx-auto max-w-4xl px-4 text-center ${r.className}`}>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Your business runs in five different places</h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted">
          Client details in your messages. Deadlines in a spreadsheet. Invoices in a web tool you log into every month.
          Nothing talks to anything else — and things slip.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SCATTERED.map((item) => (
            <div key={item} className="rounded-lg border border-line bg-canvas px-3 py-4 text-sm font-medium text-muted">
              {item}
            </div>
          ))}
        </div>
        <div className="my-6 text-3xl text-gold" aria-hidden>
          ↓
        </div>
        <p className="inline-block rounded-xl border border-gold/40 bg-gold/10 px-6 py-4 text-lg font-bold text-gold-strong">
          One desktop app: ClientRegit
        </p>
      </div>
    </section>
  )
}
