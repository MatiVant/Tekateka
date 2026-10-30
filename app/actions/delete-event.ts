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
    const { error: ticketsError } = await adminSupabase.from("tickets").delete().eq("event_id", eventId)

    if (ticketsError) {
      console.error("[v0] Error deleting tickets:", ticketsError)
      return { success: false, error: "Error al eliminar tickets asociados" }
    }

    // Eliminar ticket_tiers asociados
    const { error: shareLinksError } = await adminSupabase.from("artist_share_links").delete().eq("event_id", eventId)
    if (shareLinksError) console.error("[v0] Error deleting artist share links:", shareLinksError)

    const { error: ownershipError } = await adminSupabase.from("event_ownership_transfers").delete().eq("event_id", eventId)
    if (ownershipError) console.error("[v0] Error deleting ownership transfers:", ownershipError)

    const { error: tiersError } = await adminSupabase.from("ticket_tiers").delete().eq("event_id", eventId)

    if (tiersError) {
      console.error("[v0] Error deleting tiers:", tiersError)
    }

    // Eliminar promotion_codes asociados
    const { error: promoError } = await adminSupabase.from("promotion_codes").delete().eq("event_id", eventId)

    if (promoError) {
      console.error("[v0] Error deleting promotion codes:", promoError)
    }

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
