import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import {
  cookieHasPromo,
  cookieWithPromo,
  PROMO_USED_ACCOUNT_MESSAGE,
  PROMO_USED_COOKIE,
  PROMO_USED_DEVICE_MESSAGE,
} from "@/lib/promo-device-usage"

const INACTIVE_TICKET_STATUSES = ["cancelled", "rejected"]

type PromoUseLookup = {
  promoId: string
  eventId: string
  email?: string | null
  userId?: string | null
}

async function findBuyerPromoUse(supabase: SupabaseClient, lookup: PromoUseLookup, mode: "active" | "inactive") {
  const email = lookup.email?.trim().toLowerCase() || null
  const userId = lookup.userId || null
  if (!email && !userId) return null

  const base = () => {
    const query = supabase
      .from("ticket_promotions")
      .select("ticket_id, tickets!inner(id, event_id, buyer_email, buyer_id, status)")
      .eq("promotion_code_id", lookup.promoId)
      .eq("tickets.event_id", lookup.eventId)
    return mode === "active"
      ? query.not("tickets.status", "in", "(cancelled,rejected)")
      : query.in("tickets.status", INACTIVE_TICKET_STATUSES)
  }

  if (email) {
    const { data, error } = await base().ilike("tickets.buyer_email", email).limit(1)
    if (error) throw error
    if (data?.[0]) return data[0]
  }
  if (userId) {
    const { data, error } = await base().eq("tickets.buyer_id", userId).limit(1)
    if (error) throw error
    if (data?.[0]) return data[0]
  }
  return null
}

export async function deviceHasUsedPromo(eventId: string, code: string) {
  const store = await cookies()
  return cookieHasPromo(store.get(PROMO_USED_COOKIE)?.value, eventId, code)
}

export async function markPromoUsedOnServerDevice(eventId: string, code: string) {
  const store = await cookies()
  store.set(PROMO_USED_COOKIE, cookieWithPromo(store.get(PROMO_USED_COOKIE)?.value, eventId, code), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    secure: process.env.NODE_ENV === "production",
  })
}

// Bloquea un segundo uso del mismo código por el mismo mail/usuario, o por el
// mismo dispositivo (cookie httpOnly). Si la compra anterior se canceló o se
// rechazó, se puede volver a intentar con el mismo mail.
export async function assertPromoNotAlreadyUsed(
  supabase: SupabaseClient,
  lookup: PromoUseLookup & { code: string },
): Promise<{ ok: true; allowedAfterCancel?: boolean } | { ok: false; error: string }> {
  try {
    const active = await findBuyerPromoUse(supabase, lookup, "active")
    if (active) return { ok: false, error: PROMO_USED_ACCOUNT_MESSAGE }

    const cancelledUse = (lookup.email?.trim() || lookup.userId)
      ? await findBuyerPromoUse(supabase, lookup, "inactive")
      : null
    if (cancelledUse) return { ok: true, allowedAfterCancel: true }

    if (await deviceHasUsedPromo(lookup.eventId, lookup.code)) {
      return { ok: false, error: PROMO_USED_DEVICE_MESSAGE }
    }
    return { ok: true }
  } catch (error) {
    console.error("[promos] No se pudo verificar un uso anterior del código:", error)
    return { ok: false, error: "No se pudo verificar el uso del código" }
  }
}

export { PROMO_USED_ACCOUNT_MESSAGE, PROMO_USED_DEVICE_MESSAGE }
