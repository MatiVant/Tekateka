"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { slugify } from "@/lib/slugify"

export async function updateOrganizerCover(organizerProfileId: string, coverUrl: string | null) {
  if (!organizerProfileId || organizerProfileId.length > 100) {
    return { error: "El organizador seleccionado no es válido." }
  }

  if (coverUrl !== null) {
    try {
      const parsedUrl = new URL(coverUrl)
      if (
        parsedUrl.protocol !== "https:" ||
        !parsedUrl.hostname.endsWith(".public.blob.vercel-storage.com") ||
        coverUrl.length > 2048
      ) {
        return { error: "La URL de la portada no es válida." }
      }
    } catch {
      return { error: "La URL de la portada no es válida." }
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Iniciá sesión para cambiar la portada." }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  const isSuperadmin = currentProfile?.role === "superadmin"
  if (!isSuperadmin && currentProfile?.role !== "organizer") {
    return { error: "No tenés permiso para cambiar esta portada." }
  }

  const adminSupabase = createAdminClient()
  const { data: targetProfile } = await adminSupabase
    .from("profiles")
    .select("id, role, organization_name, full_name")
    .eq("id", organizerProfileId)
    .maybeSingle()

  if (!targetProfile || (targetProfile.role !== "organizer" && targetProfile.role !== "superadmin")) {
    return { error: "No se encontró el perfil de organizador." }
  }
  if (!isSuperadmin && targetProfile.id !== user.id) {
    return { error: "Solo podés cambiar la portada de tu propio espacio." }
  }

  const writer = isSuperadmin ? adminSupabase : supabase
  const { data: updatedProfile, error } = await writer
    .from("profiles")
    .update({ organization_cover_image_url: coverUrl })
    .eq("id", organizerProfileId)
    .select("id")
    .maybeSingle()

  if (error || !updatedProfile) {
    return { error: "No se pudo guardar la portada del organizador." }
  }

  const organizationName = targetProfile.organization_name?.trim() || targetProfile.full_name?.trim() || ""
  if (organizationName) revalidatePath(`/${slugify(organizationName)}`)
  revalidatePath("/admin")
  revalidatePath("/profile")

  return { success: true }
}
