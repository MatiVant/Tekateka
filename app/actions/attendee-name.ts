"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/auth"
import { checkRateLimit, rateLimitMessage, RATE_LIMITS } from "@/lib/rate-limit"
import {
  ATTENDEE_NAME_DISABLED_MESSAGE,
  eventDateHasPassed,
  isMissingAttendeeColumn,
  isUuid,
  normalizeAttendeeName,
  ticketOwnerMatches,
} from "@/lib/attendee-name"

export type UpdateAttendeeNameResult = { ok: true; attendeeName: string | null } | { ok: false; error: string }

// Pone, cambia o borra el nombre de una entrada. Solo el dueño (con cuenta),
// por buyer_id o por el email confirmado, y solo si está pendiente/confirmada
// y el evento todavía no empezó. El chequeo de dueño es explícito (service role).
export async function updateAttendeeName(ticketId: string, rawName: string): Promise<UpdateAttendeeNameResult> {
  const userData = await getCurrentUser()
  if (!userData) return { ok: false, error: "Iniciá sesión para ponerle nombre a tus entradas" }
  if (!isUuid(String(ticketId ?? ""))) return { ok: false, error: "Entrada inválida" }

  const parsed = normalizeAttendeeName(rawName)
  if (!parsed.ok) return parsed

  const limit = await checkRateLimit(`user:${userData.user.id}`, "attendee-name", RATE_LIMITS.attendeeName)
  if (!limit.success) return { ok: false, error: rateLimitMessage(limit.resetAt) }

  const supabase = createClient()
  const { data: ticket, error: loadError } = await supabase
    .from("tickets")
    .select("id, buyer_id, buyer_email, status, events(event_date)")
    .eq("id", ticketId)
    .maybeSingle()
  if (loadError) {
    console.error("[attendee-name] No se pudo leer la entrada:", loadError.code, loadError.message)
    return { ok: false, error: "No se pudo guardar el nombre" }
  }
  if (!ticket || !ticketOwnerMatches(ticket, userData.user)) {
    return { ok: false, error: "No encontramos esa entrada en tu cuenta" }
  }
  if (ticket.status !== "pending" && ticket.status !== "confirmed") {
    return { ok: false, error: "Esta entrada ya no se puede modificar" }
  }
  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  if (eventDateHasPassed(event?.event_date)) {
    return { ok: false, error: "Esta entrada ya no se puede modificar porque el evento ya pasó" }
  }

  const values: { attendee_name: string | null; buyer_id?: string } = { attendee_name: parsed.value }
  if (!ticket.buyer_id) values.buyer_id = userData.user.id

  const { data: updated, error } = await supabase
    .from("tickets")
    .update(values)
    .eq("id", ticketId)
    .in("status", ["pending", "confirmed"])
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[attendee-name] No se pudo guardar el nombre:", error.code, error.message)
    if (isMissingAttendeeColumn(error)) return { ok: false, error: ATTENDEE_NAME_DISABLED_MESSAGE }
    return { ok: false, error: "No se pudo guardar el nombre" }
  }
  if (!updated) return { ok: false, error: "Esta entrada ya no se puede modificar" }

  revalidatePath("/my-tickets")
  return { ok: true, attendeeName: parsed.value }
}
