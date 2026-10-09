import type { ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currency'
import { useSession } from '@/lib/auth'
import { DOWNLOADS, SITE } from '@shared/site'
import { supabaseConfigured } from '@/lib/supabase'

function scrollToId(id: string): void {
  const element = document.getElementById(id)
  if (element) element.scrollIntoView({ behavior: 'smooth' })
}

export function SiteLayout(): ReactNode {
  const location = useLocation()
  const navigate = useNavigate()
  const { currency, setCurrency } = useCurrency()
  const { session } = useSession()

  const goSection = (id: string): void => {
    if (location.pathname !== '/') {
      navigate('/')
      setTimeout(() => scrollToId(id), 80)
    } else {
      scrollToId(id)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo-emblem.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-lg font-bold tracking-tight">{SITE.name}</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <button className="cursor-pointer hover:text-ink" onClick={() => goSection('features')}>
              Features
            </button>
            <button className="cursor-pointer hover:text-ink" onClick={() => goSection('pricing')}>
              Pricing
            </button>
            <button className="cursor-pointer hover:text-ink" onClick={() => goSection('faq')}>
              FAQ
            </button>
            <Link to="/account" className="hover:text-ink">
              Account
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-lg border border-line text-xs font-semibold">
              {(['INR', 'USD'] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => setCurrency(code)}
                  className={`cursor-pointer px-2.5 py-1.5 transition-colors ${
                    currency === code ? 'bg-gold text-white' : 'bg-surface text-muted hover:text-ink'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            {session ? (
              <Link
                to="/account"
                className="rounded-lg bg-gold px-3.5 py-2 text-sm font-medium text-white hover:bg-gold-strong"
              >
                Account
              </Link>
            ) : (
              <Link
                to="/auth"
                className="rounded-lg bg-gold px-3.5 py-2 text-sm font-medium text-white hover:bg-gold-strong"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {!supabaseConfigured() && (
        <div className="bg-warn px-4 py-1.5 text-center text-xs font-medium text-white">
          Dev notice: Supabase env vars are not set — sign-in and checkout won&apos;t work yet.
        </div>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2.5">
                <img src="/logo-emblem.png" alt="" className="h-7 w-7 object-contain" />
                <span className="font-bold">{SITE.name}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{SITE.tagline} — clients, projects and invoices in one desktop app.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Download</h3>
              <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
                <a href={DOWNLOADS.windows} className="hover:text-ink">
                  Windows (x64)
                </a>
                <a href={DOWNLOADS.macos} className="hover:text-ink">
                  macOS (Apple Silicon)
                </a>
                <span>7-day free trial · No card needed</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Company</h3>
              <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
                <a href={`mailto:${SITE.supportEmail}`} className="hover:text-ink">
                  Support
                </a>
                <button className="w-fit cursor-pointer text-left hover:text-ink" onClick={() => goSection('pricing')}>
                  Pricing
                </button>
                <Link to="/account" className="hover:text-ink">
                  Account
                </Link>
                <Link to="/privacy" className="hover:text-ink">
                  Privacy
                </Link>
                <Link to="/terms" className="hover:text-ink">
                  Terms
                </Link>
                <Link to="/refunds" className="hover:text-ink">
                  Refunds
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-line pt-6 text-xs text-muted">
            © {new Date().getFullYear()} {SITE.name} — {SITE.tagline}
          </div>
        </div>
      </footer>
    </div>
  )
}
