import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { supabaseConfigured } from '@/lib/supabase-env'
import { SITE } from '@shared/site'

type Mode = 'signin' | 'signup' | 'forgot'

const PASSWORD_RULE = 'At least 8 characters with uppercase, lowercase, number & symbol'
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

function EyeIcon({ off }: { off: boolean }): ReactNode {
  return off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m1 1 22 22" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function Auth(): ReactNode {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)

  const [otpStage, setOtpStage] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  const [otpMessage, setOtpMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  const next = params.get('next') || '/account'

  const submit = async (): Promise<void> => {
    if (!supabaseConfigured()) {
      setMessage({ kind: 'error', text: 'Supabase is not configured yet — set the env vars first.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'forgot') {
        const { error } = await supabase().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })
        if (error) throw error
        setMessage({ kind: 'info', text: 'Check your inbox — we sent a password reset link.' })
        return
      }
      if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Full name is required.')
        if (!phone.trim()) throw new Error('Phone number is required.')
        if (!PASSWORD_RE.test(password)) {
          throw new Error(`Password must be ${PASSWORD_RULE.toLowerCase()}.`)
        }
        if (!accepted) {
          throw new Error('Please accept the Privacy Policy, Terms & Conditions, and Refund Policy.')
        }
        const { error } = await supabase().auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim(), phone: phone.trim() }
          }
        })
        if (error) throw error
        const otpSend = await supabase().auth.signInWithOtp({ email: email.trim() })
        if (otpSend.error) throw otpSend.error
        setOtpStage(true)
        setOtpCode('')
        setOtpMessage({ kind: 'info', text: 'Enter the 6-digit code we just emailed you.' })
        setResendCooldown(30)
        const timer = setInterval(() => {
          setResendCooldown((s) => {
            if (s <= 1) {
              clearInterval(timer)
              return 0
            }
            return s - 1
          })
        }, 1000)
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

  const verifyOtp = async (): Promise<void> => {
    if (!otpCode.trim()) {
      setOtpMessage({ kind: 'error', text: 'Enter the 6-digit code.' })
      return
    }
    setOtpBusy(true)
    setOtpMessage(null)
    try {
      const { error } = await supabase().auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email'
      })
      if (error) throw error
      navigate(next, { replace: true })
    } catch (err) {
      setOtpMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setOtpBusy(false)
    }
  }

  const resendOtp = async (): Promise<void> => {
    if (resendCooldown > 0) return
    setOtpBusy(true)
    setOtpMessage(null)
    try {
      const { error } = await supabase().auth.signInWithOtp({ email: email.trim() })
      if (error) throw error
      setOtpMessage({ kind: 'info', text: 'New code sent — check your inbox.' })
      setResendCooldown(30)
      const timer = setInterval(() => {
        setResendCooldown((s) => {
          if (s <= 1) {
            clearInterval(timer)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } catch (err) {
      setOtpMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setOtpBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo-emblem.png" alt="" className="mb-3 h-12 w-12 object-contain" />
          <h1 className="text-xl font-bold tracking-tight">
            {mode === 'signin' ? 'Welcome back' : mode === 'forgot' ? 'Reset your password' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'signin'
              ? 'Sign in to buy a plan or manage your license key.'
              : mode === 'forgot'
                ? "Enter your email and we'll send you a reset link."
                : `One account for ${SITE.name} — keys and invoices live here.`}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1 text-sm font-medium">
          {(['signin', 'signup', 'forgot'] as Mode[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setMode(tab)
                setMessage(null)
                setOtpStage(false)
              }}
              className={`cursor-pointer rounded-md py-2 transition-colors ${
                mode === tab ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {tab === 'signin' ? 'Sign in' : tab === 'signup' ? 'Sign up' : 'Reset'}
            </button>
          ))}
        </div>

        {otpStage ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              We emailed a 6-digit code to <span className="font-semibold text-ink">{email}</span>.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Verification code
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-gold"
              />
            </label>
            {otpMessage && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  otpMessage.kind === 'error'
                    ? 'border-danger/30 bg-red-50 text-danger'
                    : 'border-success/30 bg-green-50 text-success'
                }`}
              >
                {otpMessage.text}
              </div>
            )}
            <button
              type="button"
              onClick={() => void verifyOtp()}
              disabled={otpBusy}
              className="w-full cursor-pointer rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50"
            >
              {otpBusy ? 'Verifying…' : 'Verify & create account'}
            </button>
            <div className="flex items-center justify-between text-xs text-muted">
              <button
                type="button"
                onClick={() => void resendOtp()}
                disabled={otpBusy || resendCooldown > 0}
                className="cursor-pointer text-gold-strong underline hover:text-gold disabled:cursor-default disabled:text-muted disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpStage(false)
                  setOtpCode('')
                  setOtpMessage(null)
                  setMessage(null)
                }}
                className="cursor-pointer text-muted hover:text-ink"
              >
                Back to sign up
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
          {mode === 'signup' && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Full name
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Phone number
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </label>
            </>
          )}

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

          {mode !== 'forgot' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? 'Uppercase, lowercase, number & symbol' : 'At least 6 characters'}
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2 pr-10 text-sm outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-muted hover:text-ink"
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-muted">{PASSWORD_RULE}</p>
              )}
            </label>
          )}

          {mode === 'signup' && (
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-gold"
              />
              <span>
                I accept the{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-gold-strong underline hover:text-gold">
                  Privacy Policy
                </a>
                {', '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-gold-strong underline hover:text-gold">
                  Terms &amp; Conditions
                </a>
                {' and '}
                <a href="/refunds" target="_blank" rel="noopener noreferrer" className="text-gold-strong underline hover:text-gold">
                  Refund Policy
                </a>
                .
              </span>
            </label>
          )}

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
            {busy
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign in'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Create account'}
          </button>
        </form>
        )}

        {!otpStage && (
        <p className="mt-5 text-center text-xs text-muted">
          {mode === 'signin' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setMessage(null)
                }}
                className="cursor-pointer text-gold-strong underline hover:text-gold"
              >
                Forgot password?
              </button>
              {' · '}
            </>
          ) : null}
          Already bought? Sign in and copy your key from the{' '}
          <Link to="/account" className="text-gold-strong underline">
            account page
          </Link>
          .
        </p>
        )}

      </div>
    </div>
  )
}
