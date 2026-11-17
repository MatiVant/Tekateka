import type { SupabaseClient } from "@supabase/supabase-js"

export const DEFAULT_PLATFORM_FEE_PERCENT = 8
// La comisión queda pausada hasta que el superadmin solicite activarla nuevamente.
export const PLATFORM_FEE_ENABLED = false

export function calculatePlatformFee(amount: number, percent: number) {
  if (amount <= 0 || percent <= 0) return 0
  return Math.round(amount * percent) / 100
}

export async function getPlatformFeePercent(supabase: SupabaseClient, venueId?: string | null, eventCreatedAt?: string | null) {
  if (!PLATFORM_FEE_ENABLED) return 0

  const [{ data: settings }, venueResult] = await Promise.all([
    supabase.from("platform_settings").select("value").eq("key", "platform_fee_percent").maybeSingle(),
    venueId ? supabase.from("venues").select("platform_fee_percent").eq("id", venueId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const value = settings?.value && typeof settings.value === "object" ? settings.value as { percent?: number; starts_at?: string | null } : {}
  if (value.starts_at && eventCreatedAt) {
    const createdDate = new Date(eventCreatedAt).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
    if (createdDate < value.starts_at) return 0
  }
  const venuePercent = venueResult.data?.platform_fee_percent
  return Number(venuePercent ?? value.percent ?? DEFAULT_PLATFORM_FEE_PERCENT)
}
