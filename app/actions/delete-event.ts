"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function deleteEvent(eventId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "No autenticado" }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const isSuperadmin = profile?.role === "superadmin"
    const lookupClient = isSuperadmin ? createAdminClient() : supabase
    const { data: event, error: eventLookupError } = await lookupClient
      .from("events")
      .select("id, organizer_id, status")
      .eq("id", eventId)
      .single()

    if (eventLookupError || !event) return { success: false, error: "Evento no encontrado" }
    if (event.organizer_id !== user.id && !isSuperadmin) {
      return { success: false, error: "No autorizado" }
    }

    const adminSupabase = createAdminClient()
    const { data: eventTickets, error: ticketLookupError } = await adminSupabase
      .from("tickets")
      .select("status, payment_status")
      .eq("event_id", eventId)

    if (ticketLookupError) {
      console.error("[v0] Error checking event tickets before deletion:", ticketLookupError)
      return { success: false, error: "No se pudo verificar si el evento tiene entradas cobradas" }
    }

    const hasCollectedTickets = (eventTickets || []).some((ticket) =>
      ticket.status !== "cancelled" &&
      (ticket.status === "confirmed" || ticket.status === "used" || ticket.payment_status === "approved"),
    )

    if (hasCollectedTickets) {
      return { success: false, error: "No se puede eliminar un evento con entradas cobradas o confirmadas" }
    }

    // El superadmin necesita borrar con service role para no quedar bloqueado por RLS.
    // Estas tablas son independientes entre sí, por lo que se pueden limpiar en paralelo.
    const [ticketsResult, shareLinksResult, ownershipResult, tiersResult, promoResult] = await Promise.all([
      adminSupabase.from("tickets").delete().eq("event_id", eventId),
      adminSupabase.from("artist_share_links").delete().eq("event_id", eventId),
      adminSupabase.from("event_ownership_transfers").delete().eq("event_id", eventId),
      adminSupabase.from("ticket_tiers").delete().eq("event_id", eventId),
      adminSupabase.from("promotion_codes").delete().eq("event_id", eventId),
    ])

    if (ticketsResult.error) {
      console.error("[v0] Error deleting tickets:", ticketsResult.error)
      return { success: false, error: "Error al eliminar tickets asociados" }
    }
    if (shareLinksResult.error) console.error("[v0] Error deleting artist share links:", shareLinksResult.error)
    if (ownershipResult.error) console.error("[v0] Error deleting ownership transfers:", ownershipResult.error)
    if (tiersResult.error) console.error("[v0] Error deleting tiers:", tiersResult.error)
    if (promoResult.error) console.error("[v0] Error deleting promotion codes:", promoResult.error)

    // Finalmente eliminar el evento
    const { error: eventError } = await adminSupabase.from("events").delete().eq("id", eventId)

    if (eventError) {
      console.error("[v0] Error deleting event:", eventError)
      return { success: false, error: "Error al eliminar el evento" }
    }

    revalidatePath("/superadmin/events")
    revalidatePath("/admin")
    revalidatePath("/")

    return { success: true }
  } catch (error) {
    console.error("[v0] Exception deleting event:", error)
    return { success: false, error: "Error inesperado al eliminar el evento" }
  }
}
