import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { supabaseConfigured } from '@/lib/supabase-env'

export function ResetPassword(): ReactNode {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    if (!supabaseConfigured()) {
      setChecking(false)
      return
    }
    let alive = true
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!alive) return
        setSession(data.session)
        setChecking(false)
      })
      .catch(() => {
        if (alive) setChecking(false)
      })
    const { data: sub } = supabase().auth.onAuthStateChange((_event, s) => {
      if (!alive) return
      setSession(s)
      setChecking(false)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const submit = async (): Promise<void> => {
    if (password.length < 8) {
      setMessage({ kind: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (password !== confirm) {
      setMessage({ kind: 'error', text: 'Passwords do not match.' })
      return
    }
    setBusy(true)
    setMessage(null)
    const { error } = await supabase().auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setMessage({ kind: 'error', text: error.message })
      return
    }
    setMessage({ kind: 'success', text: 'Password updated — redirecting to sign in…' })
    setTimeout(() => {
      window.location.hash = '/auth'
    }, 1500)
  }

  if (checking) {
    return (
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm text-center text-sm text-muted">
          Verifying reset link…
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm text-center">
          <h1 className="text-xl font-bold tracking-tight">Link expired</h1>
          <p className="mt-2 text-sm text-muted">
            This password reset link is invalid or has expired. Request a new one.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-block rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-gold-strong"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-muted">Choose a strong password for your account.</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              New password
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Confirm password
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat password"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </label>

          {message && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                message.kind === 'error'
                  ? 'border-danger/30 bg-red-50 text-danger'
                  : message.kind === 'success'
                    ? 'border-success/30 bg-green-50 text-success'
                    : 'border-line bg-surface-2 text-muted'
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
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
