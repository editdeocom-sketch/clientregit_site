import type { ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCurrency } from '@/lib/currency'
import { useSession } from '@/lib/auth'
import { SITE } from '@shared/site'
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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-emblem.png" alt="" className="h-6 w-6 object-contain" />
            <span>
              © {new Date().getFullYear()} {SITE.name} — {SITE.tagline}
            </span>
          </div>
          <div className="flex flex-wrap gap-5">
            <a href={`mailto:${SITE.supportEmail}`} className="hover:text-ink">
              Support
            </a>
            <button className="cursor-pointer hover:text-ink" onClick={() => goSection('pricing')}>
              Pricing
            </button>
            <Link to="/account" className="hover:text-ink">
              Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
