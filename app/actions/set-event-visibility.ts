"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { slugify } from "@/lib/slugify"

export async function setEventVisibility(eventId: string, isPublic: boolean) {
  if (!eventId || typeof isPublic !== "boolean") {
    return { success: false, error: "Datos del evento no válidos" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "No autenticado" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_name, full_name")
    .eq("id", user.id)
    .maybeSingle()

  const isSuperadmin = profile?.role === "superadmin"
  const adminSupabase = isSuperadmin ? createAdminClient() : null
  const dataClient = adminSupabase ?? supabase
  const { data: event, error: eventError } = await dataClient
    .from("events")
    .select("id, organizer_id")
    .eq("id", eventId)
    .maybeSingle()

  if (eventError || !event) return { success: false, error: "Evento no encontrado" }
  if (event.organizer_id !== user.id && !isSuperadmin) {
    return { success: false, error: "No autorizado" }
  }

  const { error: updateError } = await dataClient
    .from("events")
    .update({ is_public: isPublic })
    .eq("id", eventId)

  if (updateError) return { success: false, error: "No se pudo cambiar la visibilidad del evento" }

  let publicName = profile?.organization_name || profile?.full_name
  if (event.organizer_id !== user.id) {
    const { data: organizerProfile } = await dataClient
      .from("profiles")
      .select("organization_name, full_name")
      .eq("id", event.organizer_id)
      .maybeSingle()
    publicName = organizerProfile?.organization_name || organizerProfile?.full_name
  }
  revalidatePath("/")
  revalidatePath("/eventos")
  revalidatePath("/admin")
  if (publicName) revalidatePath(`/${slugify(publicName)}`)

  return { success: true }
}
