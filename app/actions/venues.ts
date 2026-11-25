"use server"

import { revalidatePath } from "next/cache"
import { Resend } from "resend"
import { createClient } from "@/lib/supabase/admin"
import { requireAuth, requireSuperadmin } from "@/lib/auth"
import { EMAIL_CONFIG } from "@/lib/email-config"
import { escapeHtml } from "@/lib/event-location"
import { checkRateLimit, rateLimitMessage, RATE_LIMITS } from "@/lib/rate-limit"
import { redactForLog } from "@/lib/mask-personal-data"

export type SaveVenueResult = { ok: true } | { ok: false; error: string }

const MAX_NAME = 120
const MAX_ADDRESS = 200
const MAX_URL = 500
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MISSING_COLUMN = "42703"
const PROPOSALS_DISABLED = "Las propuestas de espacios todavía no están habilitadas. Escribinos a consultas@tekateka.com.ar."

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const text = (value: FormDataEntryValue | null) => String(value ?? "").replace(/\s+/g, " ").trim()

type VenueFields = { name: string; address: string | null; location_url: string | null }

function parseVenueFields(formData: FormData, { requireAddress }: { requireAddress: boolean }): { ok: true; values: VenueFields } | { ok: false; error: string } {
  const name = text(formData.get("name"))
  const address = text(formData.get("address"))
  const locationUrl = text(formData.get("location_url"))

  if (name.length < 2 || name.length > MAX_NAME) return { ok: false, error: `El nombre debe tener entre 2 y ${MAX_NAME} caracteres` }
  if (requireAddress && address.length < 5) return { ok: false, error: "Escribí la dirección del espacio (calle, número y ciudad)" }
  if (address.length > MAX_ADDRESS) return { ok: false, error: `La dirección puede tener hasta ${MAX_ADDRESS} caracteres` }
  if (locationUrl) {
    if (locationUrl.length > MAX_URL) return { ok: false, error: "El link de Maps es demasiado largo" }
    try {
      const parsed = new URL(locationUrl)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocolo")
    } catch {
      return { ok: false, error: "El link de Maps no es una URL válida" }
    }
  }
  return { ok: true, values: { name, address: address || null, location_url: locationUrl || null } }
}

function revalidateVenuePages() {
  revalidatePath("/superadmin")
  revalidatePath("/admin/events/new")
  revalidatePath("/eventos")
}

async function sendBestEffortEmail(to: string[], subject: string, html: string, replyTo?: string) {
  if (!resend || to.length === 0) return
  try {
    const { error } = await resend.emails.send({ from: EMAIL_CONFIG.from, replyTo: replyTo ?? EMAIL_CONFIG.replyTo, to, subject, html })
    if (error) console.error("[venues] Resend rechazó el aviso:", error.message)
  } catch (error) {
    console.error("[venues] No se pudo enviar el aviso:", redactForLog(error))
  }
}

// Alta y edición de espacios del catálogo (solo superadmin). La dirección se
// usa en los mails de entradas y en la página pública del evento.
export async function saveVenue(formData: FormData): Promise<SaveVenueResult> {
  const { authorized } = await requireSuperadmin()
  if (!authorized) return { ok: false, error: "No autorizado" }

  const id = text(formData.get("id"))
  if (id && !UUID_PATTERN.test(id)) return { ok: false, error: "Espacio inválido" }
  const parsed = parseVenueFields(formData, { requireAddress: false })
  if (!parsed.ok) return parsed

  const supabase = createClient()
  const { error } = id
    ? await supabase.from("venues").update(parsed.values).eq("id", id)
    : await supabase.from("venues").insert(parsed.values)

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya existe un espacio con ese nombre" }
    console.error("[venues] No se pudo guardar el espacio:", error.message)
    return { ok: false, error: "No se pudo guardar el espacio" }
  }

  revalidateVenuePages()
  return { ok: true }
}

// Un organizador propone un espacio nuevo. Queda pendiente (inactivo, no aparece
// en ninguna lista) hasta que el superadmin lo aprueba.
export async function proposeVenue(formData: FormData): Promise<SaveVenueResult> {
  const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])
  if (!authorized || !user) return { ok: false, error: "Iniciá sesión como organizador para proponer un espacio" }

  const limit = await checkRateLimit(`user:${user.id}`, "venue-proposal", RATE_LIMITS.venueProposal)
  if (!limit.success) return { ok: false, error: rateLimitMessage(limit.resetAt) }

  const parsed = parseVenueFields(formData, { requireAddress: true })
  if (!parsed.ok) return parsed
  const values = parsed.values

  const supabase = createClient()
  const proposal = { ...values, active: false, status: "pending", proposed_by: user.id, reviewed_at: null, reviewed_by: null }
  const { error } = await supabase.from("venues").insert(proposal)

  if (error) {
    if (error.code === MISSING_COLUMN || error.code === "PGRST204") return { ok: false, error: PROPOSALS_DISABLED }
    if (error.code !== "23505") {
      console.error("[venues] No se pudo guardar la propuesta:", error.message)
      return { ok: false, error: "No se pudo enviar la propuesta" }
    }
    // Ya hay un espacio con ese nombre: decimos cuál es su situación.
    const { data: existing } = await supabase.from("venues").select("id, status, active").eq("normalized_name", values.name.toLocaleLowerCase("es-AR")).maybeSingle()
    if (existing?.status === "pending") return { ok: false, error: "Ese espacio ya fue propuesto y está pendiente de aprobación de Tekateka" }
    if (existing?.status === "rejected" && existing.id) {
      const { error: retryError } = await supabase.from("venues").update(proposal).eq("id", existing.id)
      if (retryError) return { ok: false, error: "No se pudo enviar la propuesta" }
    } else {
      return { ok: false, error: "Ese espacio ya existe: elegilo de la lista" }
    }
  }

  const { data: superadmins } = await supabase.from("profiles").select("email").eq("role", "superadmin")
  const recipients = (superadmins ?? []).map((row) => row.email).filter((email): email is string => Boolean(email))
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tekateka.com.ar").replace(/\/$/, "")
  await sendBestEffortEmail(
    recipients,
    `Nuevo espacio para aprobar: ${values.name}`,
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717"><h2 style="margin-bottom:4px">Nuevo espacio propuesto</h2><p><strong>${escapeHtml(values.name)}</strong><br>${escapeHtml(values.address ?? "")}</p><p>Propuesto por ${escapeHtml(profile?.organization_name || profile?.full_name || user.email || "un organizador")}.</p><p><a href="${siteUrl}/superadmin#venues" style="color:#f4511e;font-weight:bold">Revisar en Espacios</a></p></div>`,
    user.email ?? undefined,
  )

  revalidatePath("/superadmin")
  return { ok: true }
}

// El superadmin aprueba (con los datos corregidos si hace falta) o rechaza una propuesta.
export async function reviewVenueProposal(formData: FormData): Promise<SaveVenueResult> {
  const { authorized, user } = await requireSuperadmin()
  if (!authorized || !user) return { ok: false, error: "No autorizado" }

  const id = text(formData.get("id"))
  const decision = text(formData.get("decision"))
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Propuesta inválida" }
  if (decision !== "approve" && decision !== "reject") return { ok: false, error: "Acción inválida" }

  const supabase = createClient()
  const { data: proposal, error: loadError } = await supabase.from("venues").select("id, name, status, proposed_by").eq("id", id).maybeSingle()
  if (loadError?.code === MISSING_COLUMN) return { ok: false, error: "Falta correr la migración 047 en Supabase" }
  if (!proposal || proposal.status !== "pending") return { ok: false, error: "La propuesta ya fue revisada" }

  const reviewed = { reviewed_by: user.id, reviewed_at: new Date().toISOString() }
  let venueName = proposal.name as string
  if (decision === "approve") {
    const parsed = parseVenueFields(formData, { requireAddress: true })
    if (!parsed.ok) return parsed
    venueName = parsed.values.name
    const { error } = await supabase.from("venues").update({ ...parsed.values, ...reviewed, status: "approved", active: true }).eq("id", id).eq("status", "pending")
    if (error) return { ok: false, error: error.code === "23505" ? "Ya existe un espacio con ese nombre" : "No se pudo aprobar el espacio" }
  } else {
    const { error } = await supabase.from("venues").update({ ...reviewed, status: "rejected", active: false }).eq("id", id).eq("status", "pending")
    if (error) return { ok: false, error: "No se pudo rechazar el espacio" }
  }

  if (proposal.proposed_by) {
    const { data: proposer } = await supabase.from("profiles").select("email").eq("id", proposal.proposed_by).maybeSingle()
    if (proposer?.email) {
      const approved = decision === "approve"
      await sendBestEffortEmail(
        [proposer.email],
        approved ? `Tu espacio ya está disponible: ${venueName}` : `Tu propuesta de espacio no fue aprobada: ${venueName}`,
        `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717"><p>Hola,</p><p>${approved ? `<strong>${escapeHtml(venueName)}</strong> ya fue aprobado por Tekateka y lo podés elegir al crear o editar tus eventos.` : `Revisamos tu propuesta de <strong>${escapeHtml(venueName)}</strong> y por ahora no la aprobamos. Si querés, escribinos a consultas@tekateka.com.ar y lo vemos.`}</p><p style="font-size:12px;color:#6b6258">Equipo Tekateka</p></div>`,
      )
    }
  }

  revalidateVenuePages()
  return { ok: true }
}
