import { SITE } from '@shared/site'
import { ShotFrame } from './ShotFrame'

function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#191510] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(200,154,43,0.18),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Built for creative professionals</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl">
            Stop managing clients across five different apps.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
            {SITE.name} brings your clients, projects, revisions and invoices into one simple desktop application.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => scrollToId('pricing')}
              className="rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gold-strong"
            >
              Buy {SITE.name}
            </button>
            <button
              onClick={() => scrollToId('demo')}
              className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-gold hover:text-gold"
            >
              Watch demo
            </button>
          </div>
          <p className="mt-5 text-sm text-white/50">
            Desktop application for Windows &amp; macOS · 7-day free trial, no credit card
          </p>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-gold/10 blur-2xl" aria-hidden />
          <ShotFrame
            src="/shots/dashboard.png"
            alt="ClientRegit dashboard showing revenue, active projects and upcoming deadlines"
            label="Dashboard"
            className="relative"
          />
        </div>
      </div>
    </section>
  )
}
