import type { ReactNode } from 'react'

interface Entry {
  version: string
  date: string
  items: string[]
}

const ENTRIES: Entry[] = [
  {
    version: '1.4.0',
    date: '19 October 2026',
    items: [
      'Cloud sync for individual accounts — sign in and sync clients, projects, invoices (with items and payments) and tasks; last edit wins.',
      'Automatic JSON backups — off, daily or weekly, keeping the 7 most recent backups in a folder you choose.',
      'Crash and error log file (rotating) with a tray shortcut to open the logs folder for support.',
      'Global keyboard shortcuts — Ctrl/Cmd+K quick jump across clients, projects and invoices, Ctrl/Cmd+N new item, Ctrl/Cmd+F focus search.',
      'Sign-in rate limiting and lockout after repeated failed password attempts, on both the website and the desktop app.'
    ]
  },
  {
    version: '1.3.0',
    date: 'October 2026',
    items: [
      'Google-linked Google Meet meetings — link your Google account once, then create and see upcoming meetings from the app.',
      'Replaced the built-in meeting room and messages with the new Google Meet flow.'
    ]
  },
  {
    version: '1.2.0',
    date: 'September 2026',
    items: [
      'Video meetings, desktop notifications and a profile page.',
      'Tray mode — keep ClientRegit running in the background.',
      'Call engine and camera fixes.'
    ]
  },
  {
    version: '1.1.0',
    date: 'August 2026',
    items: [
      'Team workspaces — one license key, multiple computers, shared clients, projects and invoices.',
      'Cloud sync between your machines with task assignment for team members.'
    ]
  },
  {
    version: '1.0.1',
    date: 'July 2026',
    items: [
      'First public release — clients, projects, tasks, files, invoices, payments, calendar and reports.',
      'License activation with 7-day free trial, auto-updates, Windows and macOS builds.'
    ]
  }
]

export function Changelog(): ReactNode {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">What’s new</h1>
      <p className="mt-2 text-muted">Release notes for the ClientRegit desktop app, newest first.</p>
      <div className="mt-10 space-y-10">
        {ENTRIES.map((entry) => (
          <section key={entry.version}>
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl font-semibold">
                {entry.version === 'Unreleased' ? 'Unreleased' : `Version ${entry.version}`}
              </h2>
              <span className="text-xs text-muted">{entry.date}</span>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
        Updates download inside the app. Questions about a release? Email support — we answer within one business day.
      </p>
    </div>
  )
}
