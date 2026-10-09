import type { ReactNode } from 'react'
import { APP_VERSION } from '@shared/site'
import { useReveal } from '@/lib/useReveal'

const POINTS: Array<{ title: string; body: string }> = [
  { title: 'True desktop app', body: 'Windows 10/11 x64 and macOS on Apple Silicon. Opens fast, works offline.' },
  { title: 'Local storage', body: 'Your database lives on your PC. We never see your client data.' },
  { title: 'Backups you control', body: 'Export a JSON backup or CSV anytime. Restore on a new machine in minutes.' },
  { title: 'Lifetime or subscription', body: 'Own it forever, or pay monthly or yearly — same features either way.' },
  { title: 'GST invoices', body: '18% GST applied at checkout for Indian customers, with a proper invoice.' },
  { title: 'Free updates', body: `Every plan includes every update. Currently shipping version ${APP_VERSION}.` }
]

export function Trust(): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <section className="border-b border-line bg-surface py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div ref={r.ref} className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${r.className}`}>
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-xl border border-line bg-canvas p-5">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
