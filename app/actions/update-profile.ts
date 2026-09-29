"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { slugify } from "@/lib/slugify"

export async function updateProfile(formData: {
  full_name: string
  organization_name?: string
  organization_cover_image_url?: string | null
  phone: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "No autenticado" }
  }

  const fullName = formData.full_name.trim()
  if (!fullName) {
    return { error: "El nombre no puede estar vacío" }
  }

  const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const isOrganizer = currentProfile?.role === "organizer" || currentProfile?.role === "superadmin"

  const organizationName = formData.organization_name?.trim() || ""
  if (isOrganizer && !organizationName) {
    return { error: "El nombre del espacio es obligatorio para organizadores" }
  }

  const coverImageUrl = formData.organization_cover_image_url?.trim() || null
  if (coverImageUrl && (!coverImageUrl.startsWith("https://") || coverImageUrl.length > 2048)) {
    return { error: "La URL de la portada no es válida" }
  }

  const phone = formData.phone.trim()
  if (isOrganizer && !phone) {
    return { error: "El teléfono de contacto es obligatorio para organizadores" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      ...(isOrganizer
        ? { organization_name: organizationName, organization_cover_image_url: coverImageUrl }
        : {}),
      phone: phone || null,
    })
    .eq("id", user.id)

  if (error) {
    console.log("[v0] updateProfile - Error:", error.message)
    return { error: "No se pudo actualizar el perfil" }
  }

  revalidatePath("/profile")
  revalidatePath("/superadmin")
  if (organizationName) revalidatePath(`/${slugify(organizationName)}`)
  return { success: true }
}
