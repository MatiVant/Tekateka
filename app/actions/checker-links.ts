"use server"

import crypto from "node:crypto"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/admin"

export async function createCheckerLink(label = "Control de acceso") {
  const { authorized, user } = await requireAuth(["organizer", "superadmin"])
  if (!authorized || !user) throw new Error("No autorizado")

  const rawToken = crypto.randomBytes(32).toString("base64url")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const supabase = createClient()
  const { error } = await supabase.from("ticket_checker_links").insert({
    organizer_id: user.id,
    token_hash: tokenHash,
    label: label.trim() || "Control de acceso",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (error) throw new Error("No se pudo crear el link")

  return `${process.env.NEXT_PUBLIC_SITE_URL || ""}/check/${rawToken}`
}

export async function revokeCheckerLink(id: string) {
  const { authorized, user } = await requireAuth(["organizer", "superadmin"])
  if (!authorized || !user) throw new Error("No autorizado")
  const supabase = createClient()
  await supabase.from("ticket_checker_links").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("organizer_id", user.id)
}
