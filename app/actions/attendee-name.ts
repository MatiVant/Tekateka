"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/auth"
import { checkRateLimit, rateLimitMessage, RATE_LIMITS } from "@/lib/rate-limit"
import {
  ATTENDEE_NAME_DISABLED_MESSAGE,
  isMissingAttendeeColumn,
  isUuid,
  normalizeAttendeeName,
} from "@/lib/attendee-name"

export type UpdateAttendeeNameResult = { ok: true; attendeeName: string | null } | { ok: false; error: string }

// Pone, cambia o borra el nombre de una entrada. Solo el dueño (con cuenta) y
// solo mientras la entrada está pendiente o confirmada. Usa service role, así que
// el chequeo de dueño es explícito: buyer_id tiene que ser el usuario logueado.
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
    .select("id, buyer_id, status")
    .eq("id", ticketId)
    .maybeSingle()
  if (loadError) {
    console.error("[attendee-name] No se pudo leer la entrada:", loadError.message)
    return { ok: false, error: "No se pudo guardar el nombre" }
  }
  if (!ticket || ticket.buyer_id !== userData.user.id) return { ok: false, error: "No encontramos esa entrada en tu cuenta" }
  if (ticket.status !== "pending" && ticket.status !== "confirmed") {
    return { ok: false, error: "Esta entrada ya no se puede modificar" }
  }

  const { data: updated, error } = await supabase
    .from("tickets")
    .update({ attendee_name: parsed.value })
    .eq("id", ticketId)
    .eq("buyer_id", userData.user.id)
    .in("status", ["pending", "confirmed"])
    .select("id")
    .maybeSingle()

  if (error) {
    if (isMissingAttendeeColumn(error)) return { ok: false, error: ATTENDEE_NAME_DISABLED_MESSAGE }
    console.error("[attendee-name] No se pudo guardar el nombre:", error.message)
    return { ok: false, error: "No se pudo guardar el nombre" }
  }
  if (!updated) return { ok: false, error: "Esta entrada ya no se puede modificar" }

  revalidatePath("/my-tickets")
  return { ok: true, attendeeName: parsed.value }
}
