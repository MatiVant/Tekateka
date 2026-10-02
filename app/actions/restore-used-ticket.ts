"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function restoreUsedTicket(ticketId: string) {
  if (typeof ticketId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
    return { success: false, error: "La entrada seleccionada no es válida." }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Iniciá sesión para continuar." }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "superadmin") {
    return { success: false, error: "Solo un superadmin puede revertir el uso de una entrada." }
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, event_id")
    .eq("id", ticketId)
    .eq("status", "used")
    .maybeSingle()

  if (!ticket) {
    return { success: false, error: "La entrada ya no figura como usada. Actualizá la página." }
  }

  const { data: restoredTicket, error } = await supabase
    .from("tickets")
    .update({ status: "confirmed", verified_at: null, verified_by: null })
    .eq("id", ticket.id)
    .eq("status", "used")
    .select("id")
    .maybeSingle()

  if (error || !restoredTicket) {
    return { success: false, error: "No se pudo revertir el uso de la entrada." }
  }

  revalidatePath("/admin/tickets")
  revalidatePath(`/admin/events/${ticket.event_id}/tickets`)

  return { success: true }
}

