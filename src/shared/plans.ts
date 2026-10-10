export type CurrencyCode = 'INR' | 'USD'
export type LicenseType = 'perpetual' | 'subscription'

/** Kept as a plain string alias — plan ids come from the database now. */
export type PlanId = string

export interface SitePlan {
  id: string
  name: string
  blurb: string
  licenseType: LicenseType
  /** billing period in months; null for perpetual */
  months: number | null
  /** Prices in minor units (paise / cents), before tax */
  prices: Record<CurrencyCode, number>
  active: boolean
  sortOrder: number
  highlight: boolean
  /** Seat capacity (machines per key). 1 = individual. */
  seats: number
  /** Extra-member price in minor units; 0 = no add-ons */
  pricePerSeat: Record<CurrencyCode, number>
  /** Optional marketing strike-through in minor units (admin-editable) */
  compareAt: Record<CurrencyCode, number | null>
}

/** Seed values — used as a client fallback only if the plans table is unreachable. */
export const FALLBACK_PLANS: SitePlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    blurb: 'Full access, cancel anytime. Billed every month.',
    licenseType: 'subscription',
    months: 1,
    prices: { INR: 15900, USD: 200 },
    active: true,
    sortOrder: 1,
    highlight: false,
    seats: 1,
    pricePerSeat: { INR: 0, USD: 0 },
    compareAt: { INR: 19900, USD: 250 }
  },
  {
    id: 'yearly',
    name: 'Yearly',
    blurb: 'Full access for a year — two months free vs monthly.',
    licenseType: 'subscription',
    months: 12,
    prices: { INR: 159900, USD: 1400 },
    active: true,
    sortOrder: 2,
    highlight: true,
    seats: 1,
    pricePerSeat: { INR: 0, USD: 0 },
    compareAt: { INR: 239900, USD: 1900 }
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    blurb: 'One payment, yours forever. All future updates included.',
    licenseType: 'perpetual',
    months: null,
    prices: { INR: 999900, USD: 4900 },
    active: true,
    sortOrder: 3,
    highlight: false,
    seats: 1,
    pricePerSeat: { INR: 0, USD: 0 },
    compareAt: { INR: 1599900, USD: 6900 }
  },
  {
    id: 'team-5',
    name: 'Team 5',
    blurb: 'For small crews — full access on up to 5 computers. Billed monthly.',
    licenseType: 'subscription',
    months: 1,
    prices: { INR: 69900, USD: 900 },
    active: true,
    sortOrder: 4,
    highlight: false,
    seats: 5,
    pricePerSeat: { INR: 29900, USD: 500 },
    compareAt: { INR: 99900, USD: 1200 }
  },
  {
    id: 'team-8',
    name: 'Team 8',
    blurb: 'Growing studios — full access on up to 8 computers. Billed monthly.',
    licenseType: 'subscription',
    months: 1,
    prices: { INR: 199900, USD: 2400 },
    active: true,
    sortOrder: 5,
    highlight: true,
    seats: 8,
    pricePerSeat: { INR: 29900, USD: 500 },
    compareAt: { INR: 299900, USD: 3200 }
  },
  {
    id: 'team-10',
    name: 'Team 10',
    blurb: 'Full studio seat — up to 10 computers for a year.',
    licenseType: 'subscription',
    months: 12,
    prices: { INR: 1799900, USD: 19900 },
    active: true,
    sortOrder: 6,
    highlight: false,
    seats: 10,
    pricePerSeat: { INR: 29900, USD: 500 },
    compareAt: { INR: 3599900, USD: 39900 }
  }
]

/** Indian GST applied to INR prices (exclusive display). */
export const GST_PERCENT = 18

export interface PriceQuote {
  currency: CurrencyCode
  /** before tax, minor units — base plan + extra seats */
  subtotal: number
  taxPercent: number
  /** tax amount, minor units (0 for USD) */
  tax: number
  /** total charged, minor units */
  total: number
  /** extra-seat portion of subtotal (minor units) */
  extraSeatsAmount: number
}

export function quotePlan(plan: SitePlan, currency: CurrencyCode, extraSeats = 0): PriceQuote {
  const base = plan.prices[currency] ?? 0
  const perSeat = plan.pricePerSeat[currency] ?? 0
  const extras = plan.seats > 1 && extraSeats > 0 ? perSeat * extraSeats : 0
  const subtotal = base + extras
  const taxPercent = currency === 'INR' ? GST_PERCENT : 0
  const tax = Math.round((subtotal * taxPercent) / 100)
  return { currency, subtotal, taxPercent, tax, total: subtotal + tax, extraSeatsAmount: extras }
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

export function savePercent(plan: SitePlan, currency: CurrencyCode): number | null {
  const compare = plan.compareAt[currency]
  const price = plan.prices[currency]
  if (!compare || compare <= price) return null
  return Math.round((1 - price / compare) * 100)
}
