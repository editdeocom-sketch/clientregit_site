import { useEffect, useState, type ReactNode } from 'react'
import { useReveal } from '@/lib/useReveal'
import { ShotFrame } from './ShotFrame'

const STEP_MS = 9000

const STEPS = [
  {
    label: 'Clients',
    title: '1. Add a client',
    body: 'Name, contact details, tags and notes — everyone you work with in one place.',
    src: '/shots/clients.webp',
    alt: 'ClientRegit clients list with search and new-client button'
  },
  {
    label: 'Projects',
    title: '2. Start a project',
    body: 'Give the job a status, deadline and tasks. Link the footage folders you already use.',
    src: '/shots/project.webp',
    alt: 'ClientRegit project page with tasks and status'
  },
  {
    label: 'Invoices',
    title: '3. Send an invoice',
    body: 'Bill in seconds from your business details, then log payments as they come in.',
    src: '/shots/invoice.webp',
    alt: 'ClientRegit invoice editor with line items and payment recording'
  },
  {
    label: 'Dashboard',
    title: '4. Watch it add up',
    body: 'Revenue, active jobs and overdue items update automatically — nothing to reconcile.',
    src: '/shots/dashboard.webp',
    alt: 'ClientRegit dashboard with revenue overview and active projects'
  }
]

export function Demo(): ReactNode {
  const r = useReveal<HTMLDivElement>()
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing || step >= STEPS.length - 1) return
    const timer = window.setTimeout(() => setStep((current) => current + 1), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [playing, step])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches) setPlaying(false)
  }, [])

  const current = STEPS[step]

  return (
    <section id="demo" className="border-b border-line bg-surface-2 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Client → project → invoice</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            The whole workflow in about 30 seconds — a guided tour of the shipping desktop app, exactly as it looks on
            your machine.
          </p>
        </div>

        <div ref={r.ref} className={`mx-auto mt-12 max-w-5xl ${r.className}`}>
          <div className="grid items-center gap-8 md:grid-cols-5">
            <div className="md:col-span-3">
              <ShotFrame
                key={current.src}
                src={current.src}
                alt={current.alt}
                label={current.title.replace(/^\d+\.\s*/, '')}
              />
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-strong">
                Step {step + 1} of {STEPS.length}
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight">{current.title.replace(/^\d+\.\s*/, '')}</h3>
              <p className="mt-3 text-muted">{current.body}</p>

              <div className="mt-6 flex flex-wrap gap-1.5" role="tablist" aria-label="Walkthrough steps">
                {STEPS.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    role="tab"
                    aria-selected={index === step}
                    onClick={() => {
                      setStep(index)
                      setPlaying(false)
                    }}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      index === step
                        ? 'border-gold bg-gold text-white'
                        : 'border-line bg-surface text-muted hover:border-gold hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (step >= STEPS.length - 1) setStep(0)
                    setPlaying((value) => !value)
                  }}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-gold hover:text-gold-strong"
                  aria-label={playing ? 'Pause walkthrough' : 'Play walkthrough'}
                >
                  {playing ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M8 5.5v13l11-6.5z" />
                    </svg>
                  )}
                </button>
                <div className="flex flex-1 gap-1.5" aria-hidden="true">
                  {STEPS.map((item, index) => (
                    <div key={item.label} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                      <div
                        key={index === step && playing ? `${item.label}-run` : item.label}
                        className={`h-full rounded-full bg-gold ${index < step ? 'w-full' : ''} ${
                          index > step ? 'w-0' : ''
                        }`}
                        style={
                          index === step && playing
                            ? { animation: `cr-walk ${STEP_MS}ms linear forwards` }
                            : index < step
                              ? { width: '100%' }
                              : { width: '0%' }
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-xs text-muted">
                {step >= STEPS.length - 1
                  ? 'That is the daily loop — free for 7 days, no card needed.'
                  : 'Click a step to jump · full-size screenshots on click'}
              </p>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted">
            Captured from the shipping desktop app — Windows and macOS
          </p>
        </div>
      </div>
      <style>{`@keyframes cr-walk { from { width: 0% } to { width: 100% } }`}</style>
    </section>
  )
}
