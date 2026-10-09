import type { ReactNode } from 'react'
import { useReveal } from '@/lib/useReveal'

const AUDIENCES: Array<{ icon: string; title: string; body: string }> = [
  { icon: '🎬', title: 'Video editors', body: 'Juggling multiple clients, revision rounds and delivery dates every week.' },
  { icon: '💍', title: 'Wedding & event videographers', body: 'Seasonal rushes where one missed deadline is one angry couple.' },
  { icon: '🎨', title: 'Freelance designers', body: 'Projects, feedback passes and invoices — usually in three different tools.' },
  { icon: '📷', title: 'Photographers', body: 'Shoots, deliverables and payment follow-ups stacked on top of each other.' },
  { icon: '▶️', title: 'YouTube & content creators', body: 'Sponsorships and recurring jobs that need proper tracking, not DMs.' },
  { icon: '🏢', title: 'Small creative studios', body: 'A shared view of every client, project and invoice without enterprise software.' }
]

export function WhoItsFor(): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <section className="border-b border-line bg-canvas py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Who ClientRegit is for</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Built by working creatives who were tired of running the business side from memory.
          </p>
        </div>
        <div ref={r.ref} className={`mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${r.className}`}>
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-xl border border-line bg-surface p-6">
              <span className="text-2xl" aria-hidden>
                {a.icon}
              </span>
              <h3 className="mt-3 font-semibold">{a.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
