"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/auth"

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export async function createArtistShareLink(eventId: string, permissions: { buyers?: boolean } = {}) {
  const session = await getCurrentUser()
  if (!session?.user) throw new Error("No autorizado")
  const user = session.user
  const isSuperadmin = session.profile?.role === "superadmin"
  const supabase = isSuperadmin ? createAdminClient() : await createClient()

  let eventQuery = supabase.from("events").select("id, organizer_id").eq("id", eventId)
  if (!isSuperadmin) eventQuery = eventQuery.eq("organizer_id", user.id)
  const { data: event } = await eventQuery.single()
  if (!event) throw new Error("No autorizado")

  const token = crypto.randomBytes(32).toString("base64url")
  const { data: createdLink, error } = await supabase.from("artist_share_links").insert({
    event_id: eventId,
    created_by: user.id,
    token_hash: hashToken(token),
    token,
    label: "Acceso artista",
    permissions: { sales: true, buyers: Boolean(permissions.buyers), promotions: true },
  }).select("id").single()
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/tickets`)
  return { token, linkId: createdLink?.id ?? null }
}

export async function updateArtistShareLinkPermissions(linkId: string, eventId: string, buyers: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autorizado")
  const { data: link } = await supabase.from("artist_share_links").select("permissions").eq("id", linkId).eq("event_id", eventId).eq("created_by", user.id).single()
  if (!link) throw new Error("Enlace no encontrado")
  const permissions = { ...(link.permissions ?? {}), buyers }
  const { error } = await supabase.from("artist_share_links").update({ permissions }).eq("id", linkId).eq("event_id", eventId).eq("created_by", user.id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/tickets`)
}

export async function revokeArtistShareLink(linkId: string, eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autorizado")
  const { error } = await supabase.from("artist_share_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId).eq("created_by", user.id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/tickets`)
}

export async function getArtistShareLinks(eventId: string) {
  const session = await getCurrentUser()
  if (!session?.user) return []
  const user = session.user
  const supabase = await createClient()
  const isSuperadmin = session.profile?.role === "superadmin"
  const queryClient = isSuperadmin ? createAdminClient() : supabase
  let linksQuery = queryClient.from("artist_share_links").select("id, token, label, created_at, expires_at, revoked_at, last_accessed_at, permissions").eq("event_id", eventId).is("revoked_at", null)
  if (!isSuperadmin) linksQuery = linksQuery.eq("created_by", user.id)
  const { data } = await linksQuery.order("created_at", { ascending: false })
  return data ?? []
} 
