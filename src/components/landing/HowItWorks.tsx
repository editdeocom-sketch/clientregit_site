import type { ReactNode } from 'react'
import { useReveal } from '@/lib/useReveal'

const STEPS: Array<{ n: string; title: string; body: string }> = [
  { n: '01', title: 'Download & install', body: 'Get the Windows or macOS build. Your 7-day free trial starts the first time you open the app — no card needed.' },
  { n: '02', title: 'Add your clients', body: 'Type in the clients you already work with: contacts, notes, rates. Search and tags keep the list usable as it grows.' },
  { n: '03', title: 'Create a project', body: 'Give it a status, deadline and quoted amount. Move it along the pipeline as the job progresses.' },
  { n: '04', title: 'Track tasks & files', body: 'Break the job into to-dos and link the folders you already use for footage, project files and exports.' },
  { n: '05', title: 'Invoice & record payments', body: 'Bill with a GST-ready invoice, print or export a PDF, and log payments as they come in.' }
]

export function HowItWorks(): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <section className="border-b border-line bg-surface py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">From download to first invoice in one sitting.</p>
        </div>
        <div ref={r.ref} className={`mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5 ${r.className}`}>
          {STEPS.map((step) => (
            <div key={step.n} className="rounded-xl border border-line bg-canvas p-5">
              <span className="text-xs font-bold tracking-widest text-gold">{step.n}</span>
              <h3 className="mt-2 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
