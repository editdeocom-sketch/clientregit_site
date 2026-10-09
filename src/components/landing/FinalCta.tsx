import type { ReactNode } from 'react'
import { DOWNLOADS, SITE } from '@shared/site'
import { useReveal } from '@/lib/useReveal'

export function FinalCta(): ReactNode {
  const r = useReveal<HTMLDivElement>()
  return (
    <section className="bg-[#191510] py-20 text-white">
      <div ref={r.ref} className={`mx-auto max-w-3xl px-4 text-center ${r.className}`}>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Try {SITE.name} free for 7 days</h2>
        <p className="mt-4 text-white/70">
          Download the app, import a few clients, run a real project through it. Then decide.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={DOWNLOADS.windows}
            className="rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gold-strong"
          >
            Download for Windows
          </a>
          <a
            href={DOWNLOADS.macos}
            className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-gold hover:text-gold"
          >
            Download for macOS
          </a>
        </div>
        <p className="mt-4 text-xs text-white/40">
          macOS: right-click the app → Open on first launch (unsigned build)
        </p>
      </div>
    </section>
  )
}
