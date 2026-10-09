import type { ReactNode } from 'react'

function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }): ReactNode {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated} · Plain-language summary of your rights and ours.</p>
      <div className="prose-sm mt-8 space-y-5 text-sm leading-relaxed text-ink/90">{children}</div>
    </div>
  )
}

export function Privacy(): ReactNode {
  return (
    <LegalShell title="Privacy Policy" updated="9 October 2026">
      <p>
        ClientRegit is a desktop application. Your clients, projects, tasks, invoices and all other business data are
        stored in a local database <strong>on your own computer</strong>. We do not receive, host or sync that data.
      </p>
      <p>
        <strong>What we do receive:</strong> when you create an account and purchase a license on this website, we
        store your email address, your plan, payment status and license keys (handled by our payment provider,
        Razorpay). Our server stores only what is needed to verify licenses and send purchase receipts.
      </p>
      <p>
        <strong>Cookies &amp; local storage:</strong> this site uses browser storage to keep you signed in and to
        remember your INR/USD preference. We do not run third-party advertising trackers.
      </p>
      <p>
        <strong>Analytics:</strong> none on this marketing site. The desktop app phones home only for license
        activation and update checks.
      </p>
      <p>
        <strong>Your rights:</strong> email {`support@clientregit.com`} to request deletion of your website account and
        associated license records. App data on your PC is yours to delete at any time.
      </p>
    </LegalShell>
  )
}

export function Terms(): ReactNode {
  return (
    <LegalShell title="Terms of Service" updated="9 October 2026">
      <p>
        By purchasing a ClientRegit license you agree to these terms. If you do not agree, do not purchase or continue
        using the app after your trial.
      </p>
      <p>
        <strong>License grant:</strong> a subscription license grants access for the paid period. A lifetime license
        grants perpetual use of the version you have plus all updates we ship. Licenses are for your own business use;
        sharing keys with third parties is not permitted.
      </p>
      <p>
        <strong>Accounts:</strong> you are responsible for keeping your sign-in credentials secure. Contact support if
        you believe your account is compromised.
      </p>
      <p>
        <strong>Availability:</strong> the app runs on your computer and works offline. We do not guarantee
        uninterrupted service of this website or of activation/update servers, though we make reasonable efforts to
        keep them available.
      </p>
      <p>
        <strong>Limitation of liability:</strong> to the maximum extent permitted by law, our total liability is limited
        to the amount you paid for the license in the last 12 months. The app is provided "as is".
      </p>
      <p>
        <strong>Governing law:</strong> these terms are governed by the laws of India. Questions: support@clientregit.com
      </p>
    </LegalShell>
  )
}

export function Refunds(): ReactNode {
  return (
    <LegalShell title="Refund Policy" updated="9 October 2026">
      <p>
        We want ClientRegit to be a genuine fit for your business. If it is not, we offer a full refund — no forms, no
        hoops.
      </p>
      <p>
        <strong>Window:</strong> email support@clientregit.com within <strong>14 days of purchase</strong> and we will
        refund the full amount (including GST) to the original payment method.
      </p>
      <p>
        <strong>How:</strong> include the email you used at checkout in your message. Refunds are processed back to the
        original payment method, typically within 5–10 business days depending on your bank.
      </p>
      <p>
        <strong>After a refund:</strong> the license key is deactivated and the app returns to trial/expired state. Your
        local data stays on your computer — export it before or after, it is yours either way.
      </p>
      <p>
        <strong>Subscriptions:</strong> cancel anytime from your account page. You keep access until the end of the
        paid period. The 14-day refund window also applies to the most recent renewal charge.
      </p>
    </LegalShell>
  )
}
