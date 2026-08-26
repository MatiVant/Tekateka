"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function archiveEvent(eventId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "No autenticado" }
  }

  // Verificar que el usuario sea el organizador del evento o superadmin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  const { data: event } = await supabase.from("events").select("organizer_id").eq("id", eventId).single()

  if (!event || (event.organizer_id !== user.id && profile?.role !== "superadmin")) {
    return { success: false, error: "No autorizado" }
  }

  // Archivar el evento
  const { error } = await supabase.from("events").update({ status: "finished" }).eq("id", eventId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/admin")
  revalidatePath("/")
  return { success: true }
}

export async function unarchiveEvent(eventId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "No autenticado" }
  }

  // Verificar que el usuario sea el organizador del evento o superadmin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  const { data: event } = await supabase.from("events").select("organizer_id").eq("id", eventId).single()

  if (!event || (event.organizer_id !== user.id && profile?.role !== "superadmin")) {
    return { success: false, error: "No autorizado" }
  }

  // Reactivar el evento
  const { error } = await supabase.from("events").update({ status: "active" }).eq("id", eventId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/admin")
  revalidatePath("/")
  return { success: true }
}

// Función para archivar eventos pasados automáticamente
export async function archivePastEvents() {
  const supabase = await createClient()

  const { error } = await supabase.rpc("archive_past_events")

  if (error) {
    console.error("Error archivando eventos pasados:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin")
  revalidatePath("/")
  return { success: true }
}
