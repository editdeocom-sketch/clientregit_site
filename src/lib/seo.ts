import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_URL = 'https://clientregit.com'
const DEFAULT_TITLE = 'ClientRegit — Client Management for Video Editors & Creatives'
const DEFAULT_DESCRIPTION =
  'ClientRegit is a desktop client management app for video editors, freelancers, designers and creative professionals. Manage clients, projects, revisions and invoices in one place.'

interface RouteSeo {
  title: string
  description?: string
  index?: boolean
}

const ROUTES: Array<{ match: RegExp; seo: RouteSeo }> = [
  { match: /^\/$/, seo: { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, index: true } },
  {
    match: /^\/privacy$/,
    seo: {
      title: 'Privacy Policy — ClientRegit',
      description:
        'How ClientRegit handles your data: local storage on your PC, optional account sync, team workspaces and Google account linking.',
      index: true
    }
  },
  {
    match: /^\/terms$/,
    seo: {
      title: 'Terms & Conditions — ClientRegit',
      description: 'The terms of using ClientRegit, including licensing, subscriptions and acceptable use.',
      index: true
    }
  },
  {
    match: /^\/refunds$/,
    seo: {
      title: 'Refund Policy — ClientRegit',
      description: 'ClientRegit refund policy for monthly, yearly, lifetime and team plans.',
      index: true
    }
  },
  { match: /^\/auth$/, seo: { title: 'Sign In or Create an Account — ClientRegit' } },
  { match: /^\/reset-password$/, seo: { title: 'Reset Your Password — ClientRegit' } },
  { match: /^\/checkout\//, seo: { title: 'Checkout — ClientRegit' } },
  { match: /^\/account/, seo: { title: 'My Account — ClientRegit' } },
  { match: /^\/admin/, seo: { title: 'Admin — ClientRegit' } },
  {
    match: /^\/changelog$/,
    seo: {
      title: 'What’s New — ClientRegit',
      description:
        'Release notes for ClientRegit: cloud sync, automatic backups, Google Meet, team workspaces and more.',
      index: true
    }
  }
]

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function useSeo(): void {
  const { pathname } = useLocation()
  useEffect(() => {
    const route = ROUTES.find((r) => r.match.test(pathname))
    const seo: RouteSeo = route?.seo ?? { title: 'ClientRegit' }
    const url = `${SITE_URL}${pathname === '/' ? '/' : pathname}`

    document.title = seo.title
    setCanonical(url)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:title', seo.title)
    if (seo.description) {
      setMeta('name', 'description', seo.description)
      setMeta('property', 'og:description', seo.description)
    }
    setMeta('name', 'robots', seo.index === true ? 'index, follow, max-image-preview:large' : 'noindex, nofollow')
  }, [pathname])
}
