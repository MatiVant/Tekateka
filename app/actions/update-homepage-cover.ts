"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

export async function updateHomepageCover(imageUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Iniciá sesión como administrador para cambiar la portada." }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "superadmin") return { error: "No tenés permisos para cambiar la portada del sitio." }

  if (typeof imageUrl !== "string" || imageUrl.length > 2048) {
    return { error: "La URL de la imagen no es válida." }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(imageUrl)
  } catch {
    return { error: "La URL de la imagen no es válida." }
  }
  if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".blob.vercel-storage.com")) {
    return { error: "Elegí una imagen subida desde el botón de portada." }
  }

  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase.from("site_settings").upsert(
    { id: 1, homepage_cover_image_url: parsedUrl.toString(), updated_at: new Date().toISOString() },
    { onConflict: "id" },
  )
  if (error) {
    console.error("Homepage cover update failed:", error.message)
    return { error: "No se pudo guardar la imagen de portada." }
  }

  revalidatePath("/")
  return { success: true }
}
