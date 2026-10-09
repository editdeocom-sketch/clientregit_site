import type { ReactNode } from 'react'
import { useReveal } from '@/lib/useReveal'
import { ShotFrame } from './ShotFrame'

export function Demo(): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <section id="demo" className="border-b border-line bg-surface-2 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">See it in action</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Screens straight from the app. A short walkthrough video is on the way — for now, these are the real thing.
          </p>
        </div>
        <div ref={r.ref} className={`relative mx-auto mt-12 max-w-5xl ${r.className}`}>
          <div className="grid gap-5 md:grid-cols-5">
            <div className="md:col-span-3">
              <ShotFrame
                src="/shots/dashboard.png"
                alt="ClientRegit dashboard with revenue overview and active projects"
                label="Dashboard"
              />
            </div>
            <div className="grid gap-5 md:col-span-2">
              <ShotFrame src="/shots/invoice.png" alt="ClientRegit invoice editor" label="Invoice" />
              <ShotFrame src="/shots/project.png" alt="ClientRegit project with tasks and files" label="Project" />
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-muted">
            Full 30–60s demo video coming soon · Screens captured from ClientRegit {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </section>
  )
}
