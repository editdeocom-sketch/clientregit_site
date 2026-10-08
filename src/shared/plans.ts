export type PlanId = 'lifetime' | 'monthly' | 'yearly'
export type CurrencyCode = 'INR' | 'USD'
export type LicenseType = 'perpetual' | 'subscription'

export interface Plan {
  id: PlanId
  name: string
  blurb: string
  licenseType: LicenseType
  months: number | null
  /** Prices in minor units (paise / cents), before tax */
  prices: Record<CurrencyCode, number>
}

export const PLANS: Record<PlanId, Plan> = {
  lifetime: {
    id: 'lifetime',
    name: 'Lifetime',
    blurb: 'One payment, yours forever. All future updates included.',
    licenseType: 'perpetual',
    months: null,
    prices: { INR: 399900, USD: 4900 }
  },
  monthly: {
    id: 'monthly',
    name: 'Monthly',
    blurb: 'Full access, cancel anytime. Billed every month.',
    licenseType: 'subscription',
    months: 1,
    prices: { INR: 15900, USD: 200 }
  },
  yearly: {
    id: 'yearly',
    name: 'Yearly',
    blurb: 'Full access for a year — two months free vs monthly.',
    licenseType: 'subscription',
    months: 12,
    prices: { INR: 109900, USD: 1400 }
  }
}

export const PLAN_ORDER: PlanId[] = ['monthly', 'yearly', 'lifetime']

/** Indian GST applied to INR prices (exclusive display). */
export const GST_PERCENT = 18

export function isPlanId(value: string): value is PlanId {
  return value === 'lifetime' || value === 'monthly' || value === 'yearly'
}

export interface PriceQuote {
  currency: CurrencyCode
  /** before tax, minor units */
  subtotal: number
  taxPercent: number
  /** tax amount, minor units (0 for USD) */
  tax: number
  /** total charged, minor units */
  total: number
}

export function quote(plan: PlanId, currency: CurrencyCode): PriceQuote {
  const subtotal = PLANS[plan].prices[currency]
  const taxPercent = currency === 'INR' ? GST_PERCENT : 0
  const tax = Math.round((subtotal * taxPercent) / 100)
  return { currency, subtotal, taxPercent, tax, total: subtotal + tax }
}

export function formatMoney(minor: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'INR' ? 0 : 2,
    minimumFractionDigits: currency === 'INR' ? 0 : 2
  }).format(minor / 100)
}

export function detectCurrency(): CurrencyCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'INR'
    const locale = navigator.language || ''
    if (/-IN\b/i.test(locale)) return 'INR'
  } catch {
    // fall through
  }
  return 'USD'
}
