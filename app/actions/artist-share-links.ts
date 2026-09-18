"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export async function createArtistShareLink(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autorizado")

  const { data: event } = await supabase.from("events").select("id, organizer_id").eq("id", eventId).eq("organizer_id", user.id).single()
  if (!event) throw new Error("No autorizado")

  const token = crypto.randomBytes(32).toString("base64url")
  const { error } = await supabase.from("artist_share_links").insert({
    event_id: eventId,
    created_by: user.id,
    token_hash: hashToken(token),
    label: "Acceso artista",
    permissions: { sales: true, buyers: false, promotions: true },
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/tickets`)
  return token
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from("artist_share_links").select("id, label, created_at, expires_at, revoked_at, last_accessed_at").eq("event_id", eventId).eq("created_by", user.id).order("created_at", { ascending: false })
  return data ?? []
} 
