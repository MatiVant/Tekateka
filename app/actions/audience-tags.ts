"use server"

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

export async function createAudienceTag(name: string) {
  const { authorized } = await requireAuth(["superadmin"])
  if (!authorized) throw new Error("No autorizado")
  const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 40)
  if (!cleanName) throw new Error("La etiqueta no puede estar vacía")
  const supabase = createAdminClient()
  const { error } = await supabase.from("audience_tag_options").insert({ name: cleanName })
  if (error && error.code !== "23505") throw new Error(error.message)
  revalidatePath("/superadmin")
  revalidatePath("/admin/events/new")
}

export async function toggleAudienceTag(id: string, active: boolean) {
  const { authorized } = await requireAuth(["superadmin"])
  if (!authorized) throw new Error("No autorizado")
  const supabase = createAdminClient()
  const { error } = await supabase.from("audience_tag_options").update({ active }).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/superadmin")
  revalidatePath("/admin/events/new")
}

export async function getAudienceTags() {
  const supabase = createAdminClient()
  const { data } = await supabase.from("audience_tag_options").select("id, name, active").order("name")
  return data || []
}
