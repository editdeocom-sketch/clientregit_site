import { useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currency'
import { useSession } from '@/lib/auth'
import { APP_VERSION, DOWNLOADS, SITE } from '@shared/site'
import { supabaseConfigured } from '@/lib/supabase-env'

function scrollToId(id: string): void {
  const element = document.getElementById(id)
  if (element) element.scrollIntoView({ behavior: 'smooth' })
}

const NAV_SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' }
] as const

export function SiteLayout(): ReactNode {
  const location = useLocation()
  const navigate = useNavigate()
  const { currency, setCurrency } = useCurrency()
  const { session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  const goSection = (id: string): void => {
    setMenuOpen(false)
    if (location.pathname !== '/') {
      navigate('/')
      setTimeout(() => scrollToId(id), 80)
    } else {
      scrollToId(id)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
            <img src="/logo-emblem.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-lg font-bold tracking-tight">{SITE.name}</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex" aria-label="Primary">
            {NAV_SECTIONS.map((item) => (
              <button key={item.id} className="cursor-pointer hover:text-ink" onClick={() => goSection(item.id)}>
                {item.label}
              </button>
            ))}
            <a href={DOWNLOADS.windows} className="hover:text-ink">
              Download
            </a>
            <Link to="/account" className="hover:text-ink">
              Account
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-lg border border-line text-xs font-semibold" role="group" aria-label="Currency">
              {(['INR', 'USD'] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => setCurrency(code)}
                  aria-pressed={currency === code}
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
            <button
              type="button"
              className="cursor-pointer rounded-lg border border-line bg-surface p-2 text-sm md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="mobile-menu" className="border-t border-line bg-canvas px-4 py-4 md:hidden" aria-label="Mobile">
            <div className="flex flex-col gap-1 text-sm font-medium">
              {NAV_SECTIONS.map((item) => (
                <button
                  key={item.id}
                  className="cursor-pointer rounded-lg px-3 py-2.5 text-left text-muted hover:bg-surface hover:text-ink"
                  onClick={() => goSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
              <a
                href={DOWNLOADS.windows}
                className="rounded-lg px-3 py-2.5 text-muted hover:bg-surface hover:text-ink"
                onClick={() => setMenuOpen(false)}
              >
                Download for Windows
              </a>
              <a
                href={DOWNLOADS.macos}
                className="rounded-lg px-3 py-2.5 text-muted hover:bg-surface hover:text-ink"
                onClick={() => setMenuOpen(false)}
              >
                Download for macOS
              </a>
              <Link
                to="/account"
                className="rounded-lg px-3 py-2.5 text-muted hover:bg-surface hover:text-ink"
                onClick={() => setMenuOpen(false)}
              >
                Account
              </Link>
            </div>
          </nav>
        )}
      </header>

      {!supabaseConfigured() && (
        <div className="bg-warn px-4 py-1.5 text-center text-xs font-medium text-white">
          Dev notice: Supabase env vars are not set — sign-in and checkout won&apos;t work yet.
        </div>
      )}

      <main id="main" className="flex-1">
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
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {SITE.tagline} — clients, projects and invoices in one desktop app.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Download</h3>
              <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
                <a href={DOWNLOADS.windows} className="hover:text-ink">
                  Windows (x64) · v{APP_VERSION}
                </a>
                <a href={DOWNLOADS.macos} className="hover:text-ink">
                  macOS (Apple Silicon) · v{APP_VERSION}
                </a>
                <span className="text-xs">macOS: right-click → Open on first launch</span>
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
