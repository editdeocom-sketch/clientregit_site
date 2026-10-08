import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { SITE } from '@shared/site'

type Mode = 'signin' | 'signup'

export function Auth(): ReactNode {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)

  const next = params.get('next') || '/account'

  const submit = async (): Promise<void> => {
    if (!supabaseConfigured()) {
      setMessage({ kind: 'error', text: 'Supabase is not configured yet — set the env vars first.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase().auth.signUp({ email, password })
        if (error) throw error
        if (data.session) {
          navigate(next, { replace: true })
        } else {
          setMessage({
            kind: 'info',
            text: 'Almost there — check your inbox and confirm your email, then sign in.'
          })
        }
      } else {
        const { error } = await supabase().auth.signInWithPassword({ email, password })
        if (error) {
          if (/invalid login credentials/i.test(error.message)) {
            throw new Error('Incorrect email or password.')
          }
          throw error
        }
        navigate(next, { replace: true })
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo-emblem.png" alt="" className="mb-3 h-12 w-12 object-contain" />
          <h1 className="text-xl font-bold tracking-tight">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'signin'
              ? 'Sign in to buy a plan or manage your license key.'
              : `One account for ${SITE.name} — keys and invoices live here.`}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-sm font-medium">
          {(['signin', 'signup'] as Mode[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setMode(tab)
                setMessage(null)
              }}
              className={`cursor-pointer rounded-md py-2 transition-colors ${
                mode === tab ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {tab === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </label>

          {message && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                message.kind === 'error'
                  ? 'border-danger/30 bg-red-50 text-danger'
                  : 'border-success/30 bg-green-50 text-success'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full cursor-pointer rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted">
          Already bought? Sign in and copy your key from the{' '}
          <Link to="/account" className="text-gold-strong underline">
            account page
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
