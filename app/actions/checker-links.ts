"use server"

import crypto from "node:crypto"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/admin"

export async function createCheckerLink(eventId: string, label = "Control de acceso") {
  const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])
  if (!authorized || !user) throw new Error("No autorizado")
  if (!eventId) throw new Error("Evento requerido")

  const supabase = createClient()
  const { data: event } = await supabase.from("events").select("id, organizer_id").eq("id", eventId).maybeSingle()
  if (!event || (event.organizer_id !== user.id && profile?.role !== "superadmin")) {
    throw new Error("No tenés permiso para crear un link para este evento")
  }

  const rawToken = crypto.randomBytes(32).toString("base64url")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const { error } = await supabase.from("ticket_checker_links").insert({
    organizer_id: event.organizer_id,
    event_id: event.id,
    token_hash: tokenHash,
    label: label.trim() || "Control de acceso",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (error) throw new Error("No se pudo crear el link")

  return `${process.env.NEXT_PUBLIC_SITE_URL || ""}/check/${rawToken}`
}

export async function revokeCheckerLink(id: string) {
  const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])
  if (!authorized || !user) throw new Error("No autorizado")
  const supabase = createClient()
  let query = supabase.from("ticket_checker_links").update({ revoked_at: new Date().toISOString() }).eq("id", id)
  if (profile?.role !== "superadmin") query = query.eq("organizer_id", user.id)
  const { error } = await query
  if (error) throw new Error("No se pudo revocar el link")
}
