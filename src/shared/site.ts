export const SITE = {
  name: 'ClientRegit',
  tagline: 'Client management for video editors',
  supportEmail: 'support@clientregit.com',
  address: 'ClientRegit, India'
} as const

const RELEASE = 'https://github.com/editdeocom-sketch/clientregit/releases'

export const DOWNLOADS = {
  windows: `${RELEASE}/latest/download/ClientRegit-Setup.exe`,
  macos: `${RELEASE}/latest/download/ClientRegit.dmg`,
  release: RELEASE
} as const
