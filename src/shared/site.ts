export const SITE = {
  name: 'ClientRegit',
  tagline: 'Client management for video editors',
  supportEmail: 'support@clientregit.com',
  address: 'ClientRegit, India'
} as const

/** Current desktop app version (keep in sync with the app repo). */
export const APP_VERSION = '1.0.1'

const RELEASE = 'https://github.com/editdeocom-sketch/clientregit/releases'

export const DOWNLOADS = {
  windows: `${RELEASE}/latest/download/ClientRegit-Setup.exe`,
  macos: `${RELEASE}/latest/download/ClientRegit.dmg`,
  release: RELEASE
} as const
