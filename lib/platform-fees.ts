import type { SupabaseClient } from "@supabase/supabase-js"

export const DEFAULT_PLATFORM_FEE_PERCENT = 8

export function calculatePlatformFee(amount: number, percent: number) {
  if (amount <= 0 || percent <= 0) return 0
  return Math.round(amount * percent) / 100
}

export async function getPlatformFeePercent(supabase: SupabaseClient, venueId?: string | null) {
  const [{ data: settings }, venueResult] = await Promise.all([
    supabase.from("platform_settings").select("platform_fee_percent").eq("id", true).maybeSingle(),
    venueId ? supabase.from("venues").select("platform_fee_percent").eq("id", venueId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const venuePercent = venueResult.data?.platform_fee_percent
  return Number(venuePercent ?? settings?.platform_fee_percent ?? DEFAULT_PLATFORM_FEE_PERCENT)
}
