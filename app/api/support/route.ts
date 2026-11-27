import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { Resend } from "resend"
import { EMAIL_CONFIG } from "@/lib/email-config"
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitMessage } from "@/lib/rate-limit"
import { redactForLog } from "@/lib/mask-personal-data"

const categories = new Set(["Compra o pago", "Entrada o QR", "Problema técnico", "Otro"])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" } as Record<string, string>)[character] || character)

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request)
  const rateLimit = await checkRateLimit(identifier, "/api/support", RATE_LIMITS.support)
  
  if (!rateLimit.success) {
    return NextResponse.json({ error: rateLimitMessage(rateLimit.resetAt, 3600) }, { status: 429 })
  }
  const body = await request.json().catch(() => null)
  const buyerName = String(body?.buyerName || "").trim().slice(0, 120)
  const buyerEmail = String(body?.buyerEmail || "").trim().toLowerCase().slice(0, 180)
  const eventId = body?.eventId ? String(body.eventId) : null
  const ticketId = body?.ticketId ? String(body.ticketId) : null
  const category = String(body?.category || "").trim()
  const message = String(body?.message || "").trim().slice(0, 4000)
  if (!buyerEmail.includes("@") || !categories.has(category) || message.length < 10) {
    return NextResponse.json({ error: "Completá un email, motivo y descripción válida." }, { status: 400 })
  }

  const supabase = createClient()
  const { data: supportRequest, error } = await supabase.from("support_requests").insert({
    buyer_name: buyerName || null,
    buyer_email: buyerEmail,
    event_id: eventId,
    ticket_id: ticketId,
    category,
    message,
  }).select("id").single()
  if (error || !supportRequest) return NextResponse.json({ error: "No pudimos registrar tu consulta." }, { status: 500 })

  // El nombre del evento se busca en el servidor a partir del ID: no se usa nada que mande el navegador.
  let event: { title: string | null; event_date: string | null; slug: string | null } | null = null
  if (eventId && UUID_PATTERN.test(eventId)) {
    const { data } = await supabase.from("events").select("title, event_date, slug").eq("id", eventId).maybeSingle()
    event = data ?? null
  }
  let ticketCode: string | null = null
  if (ticketId && UUID_PATTERN.test(ticketId)) {
    const { data } = await supabase.from("tickets").select("qr_code").eq("id", ticketId).maybeSingle()
    ticketCode = data?.qr_code ?? null
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tekateka.com.ar").replace(/\/$/, "")
  const eventTitle = event?.title?.trim() || null
  const eventDate = event?.event_date
    ? new Date(event.event_date).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })
    : null
  const eventUrl = event && eventId ? `${siteUrl}/events/${encodeURIComponent(event.slug || eventId)}` : null
  // Si el evento no existe (o no se pudo leer) se cae a mostrar el ID, como antes.
  const eventLabel = eventTitle ?? eventId ?? "No informado"
  const eventHtml = eventUrl
    ? `<a href="${escapeHtml(eventUrl)}">${escapeHtml(eventLabel)}</a>${eventDate ? ` — ${escapeHtml(eventDate)}` : ""}`
    : escapeHtml(eventLabel)
  const ticketLabel = ticketId ? (ticketCode ? `${ticketCode} (${ticketId})` : ticketId) : "No informado"

  const supportEmail = EMAIL_CONFIG.supportEmail
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: supportEmail,
      replyTo: buyerEmail,
      subject: `[Soporte] ${category}${eventTitle ? ` · ${eventTitle}` : ""} — ${buyerName || buyerEmail}`.replace(/[\r\n]+/g, " "),
      html: `<p><strong>Nueva consulta de soporte</strong></p><p><strong>Comprador:</strong> ${escapeHtml(buyerName || "Sin nombre")}<br><strong>Email:</strong> ${escapeHtml(buyerEmail)}<br><strong>Evento:</strong> ${eventHtml}<br><strong>Ticket:</strong> ${escapeHtml(ticketLabel)}<br><strong>Motivo:</strong> ${escapeHtml(category)}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p><p><small>Referencia de soporte: ${supportRequest.id}</small></p>`, 
    })
    if (emailError) {
      console.error("[support] Error de Resend al notificar soporte:", {
        error: redactForLog(emailError),
        supportRequestId: supportRequest.id,
      })
      return NextResponse.json({ error: "La consulta se guardó, pero no pudimos enviarla al correo de soporte." }, { status: 502 })
    }
  }

  return NextResponse.json({ ok: true, id: supportRequest.id })
}
