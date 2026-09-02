"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function deleteEvent(eventId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "No autenticado" }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const { data: event, error: eventLookupError } = await supabase
      .from("events")
      .select("id, organizer_id, status")
      .eq("id", eventId)
      .single()

    if (eventLookupError || !event) return { success: false, error: "Evento no encontrado" }
    if (event.status !== "finished") return { success: false, error: "Solo se pueden eliminar eventos archivados" }
    if (event.organizer_id !== user.id && profile?.role !== "superadmin") {
      return { success: false, error: "No autorizado" }
    }

    // Primero eliminar todos los tickets asociados
    const { error: ticketsError } = await supabase.from("tickets").delete().eq("event_id", eventId)

    if (ticketsError) {
      console.error("[v0] Error deleting tickets:", ticketsError)
      return { success: false, error: "Error al eliminar tickets asociados" }
    }

    // Eliminar ticket_tiers asociados
    const { error: tiersError } = await supabase.from("ticket_tiers").delete().eq("event_id", eventId)

    if (tiersError) {
      console.error("[v0] Error deleting tiers:", tiersError)
    }

    // Eliminar promotion_codes asociados
    const { error: promoError } = await supabase.from("promotion_codes").delete().eq("event_id", eventId)

    if (promoError) {
      console.error("[v0] Error deleting promotion codes:", promoError)
    }

    // Finalmente eliminar el evento
    const { error: eventError } = await supabase.from("events").delete().eq("id", eventId)

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
