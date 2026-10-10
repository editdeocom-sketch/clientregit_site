import { useEffect, useState } from 'react'
import { FALLBACK_PLANS, type SitePlan } from '@shared/plans'

interface PlanRow {
  id: string
  name: string
  blurb: string
  license_type: 'perpetual' | 'subscription'
  months: number | null
  price_inr: number
  price_usd: number
  active: boolean
  sort_order: number
  highlight: boolean
  seats?: number | null
  price_per_seat_inr?: number | null
  price_per_seat_usd?: number | null
  compare_at_inr?: number | null
  compare_at_usd?: number | null
}

function rowToPlan(row: PlanRow): SitePlan {
  return {
    id: row.id,
    name: row.name,
    blurb: row.blurb,
    licenseType: row.license_type,
    months: row.months,
    prices: { INR: row.price_inr, USD: row.price_usd },
    active: row.active,
    sortOrder: row.sort_order,
    highlight: row.highlight,
    seats: row.seats && row.seats > 0 ? row.seats : 1,
    pricePerSeat: {
      INR: row.price_per_seat_inr ?? 0,
      USD: row.price_per_seat_usd ?? 0
    },
    compareAt: {
      INR: row.compare_at_inr ?? null,
      USD: row.compare_at_usd ?? null
    }
  }
}

let cache: SitePlan[] | null = null

export async function loadPlans(): Promise<SitePlan[]> {
  if (cache) return cache
  try {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase().from('plans').select('*')
    if (error || !data || data.length === 0) return FALLBACK_PLANS
    cache = (data as PlanRow[]).map(rowToPlan).sort((a, b) => a.sortOrder - b.sortOrder)
    return cache
  } catch {
    return FALLBACK_PLANS
  }
}

export function invalidatePlans(): void {
  cache = null
}

export function planById(plans: SitePlan[], id: string | undefined): SitePlan | undefined {
  return id ? plans.find((p) => p.id === id) : undefined
}

export function usePlans(): SitePlan[] | null {
  const [plans, setPlans] = useState<SitePlan[] | null>(cache)
  useEffect(() => {
    let alive = true
    void loadPlans().then((p) => {
      if (alive) setPlans(p)
    })
    return () => {
      alive = false
    }
  }, [])
  return plans
}

export function usePlanName(): (id: string) => string {
  const plans = usePlans()
  return (id: string): string => plans?.find((p) => p.id === id)?.name ?? id
}
