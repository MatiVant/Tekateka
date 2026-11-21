import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth"
import { EMAIL_CONFIG } from "@/lib/email-config"
import { redactForLog } from "@/lib/mask-personal-data"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character)

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])
  if (!authorized || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!resend) return NextResponse.json({ error: "Resend no está configurado" }, { status: 503 })

  const { id } = await params
  const body = await request.json().catch(() => null) as { recipients?: unknown; subject?: unknown; message?: unknown } | null
  const recipients = [...new Set(Array.isArray(body?.recipients) ? body.recipients.map((item) => String(item).trim().toLowerCase()).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) : [])]
  const subject = String(body?.subject || "").trim()
  const message = String(body?.message || "").trim()
  if (recipients.length === 0 || recipients.length > 100) return NextResponse.json({ error: "Indicá entre 1 y 100 destinatarios válidos" }, { status: 400 })
  if (!subject || subject.length > 200) return NextResponse.json({ error: "El asunto es obligatorio y debe tener hasta 200 caracteres" }, { status: 400 })
  if (!message || message.length > 10000) return NextResponse.json({ error: "El mensaje es obligatorio y debe tener hasta 10.000 caracteres" }, { status: 400 })

  const supabase = createClient()
  const eventQuery = supabase.from("events").select("id, title, organizer_id").eq("id", id)
  const { data: event, error: eventError } = profile?.role === "superadmin" ? await eventQuery.maybeSingle() : await eventQuery.eq("organizer_id", user.id).maybeSingle()
  if (eventError || !event) return NextResponse.json({ error: "Evento no encontrado o sin permisos" }, { status: 404 })

  const { data: ticketBuyers } = await supabase.from("tickets").select("buyer_email").eq("event_id", id).eq("status", "confirmed")
  const confirmedRecipients = new Set((ticketBuyers ?? []).map((ticket) => ticket.buyer_email?.trim().toLowerCase()).filter(Boolean))
  const nonBuyerRecipients = recipients.filter((recipient) => !confirmedRecipients.has(recipient))
  if (nonBuyerRecipients.length > 0 && profile?.role !== "superadmin") return NextResponse.json({ error: "Los organizadores solo pueden enviar a compradores confirmados" }, { status: 403 })

  const result = await resend.emails.send({
    from: EMAIL_CONFIG.from,
    to: recipients,
    replyTo: EMAIL_CONFIG.replyTo,
    subject,
    html: `<main style="max-width:620px;margin:0 auto;padding:28px 18px;background:#f4eddf;color:#171717;font-family:Arial,sans-serif"><h1>${escapeHtml(subject)}</h1><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</p><p style="font-size:13px;color:#6b6258">Evento: ${escapeHtml(event.title)}</p></main>`,
  })
  if (result.error) {
    console.error("[buyer-notice] Error de Resend:", {
      error: redactForLog(result.error),
      eventId: id,
      recipients: recipients.length,
    })
    return NextResponse.json({ error: result.error.message || "Resend rechazó el envío" }, { status: 502 })
  }
  return NextResponse.json({ success: true, sent: recipients.length, emailId: result.data?.id ?? null })
}
