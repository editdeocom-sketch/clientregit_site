import { HttpError } from './http.js'
import { supabaseAdmin } from './supabase.js'

export interface CouponRow {
  id: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  plan_id: string | null
  max_uses: number | null
  used_count: number
  active: boolean
  expires_at: string | null
}

export interface ValidatedCoupon {
  coupon: CouponRow
  discountAmount: number
}

/** Validate a coupon code for a plan/subtotal and return the discount (minor units, capped at subtotal). */
export async function validateCouponFor(
  rawCode: string,
  planId: string,
  subtotal: number
): Promise<ValidatedCoupon> {
  const code = rawCode.trim().toUpperCase()
  if (!code) throw new HttpError(400, 'Coupon code is required.')

  const { data, error } = await supabaseAdmin()
    .from('coupons')
    .select('*')
    .eq('code', code)
    .single()

  if (error || !data) throw new HttpError(400, 'Invalid coupon code.')
  const coupon = data as CouponRow

  if (!coupon.active) throw new HttpError(400, 'This coupon is no longer active.')
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, 'This coupon has expired.')
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    throw new HttpError(400, 'This coupon has reached its usage limit.')
  }
  if (coupon.plan_id && coupon.plan_id !== planId) {
    throw new HttpError(400, 'This coupon does not apply to the selected plan.')
  }

  const discountAmount =
    coupon.type === 'percent'
      ? Math.round((subtotal * coupon.value) / 100)
      : Math.min(coupon.value, subtotal)

  return { coupon, discountAmount }
}
