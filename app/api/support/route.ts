import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { Resend } from "resend"
import { EMAIL_CONFIG } from "@/lib/email-config"
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitMessage } from "@/lib/rate-limit"
import { redactForLog } from "@/lib/mask-personal-data"

const categories = new Set(["Compra o pago", "Entrada o QR", "Problema técnico", "Otro"])
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

  const supportEmail = EMAIL_CONFIG.supportEmail
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: supportEmail,
      replyTo: buyerEmail,
      subject: `[Soporte] ${category} — ${buyerName || buyerEmail}`,
      html: `<p><strong>Nueva consulta de soporte</strong></p><p><strong>Comprador:</strong> ${escapeHtml(buyerName || "Sin nombre")}<br><strong>Email:</strong> ${escapeHtml(buyerEmail)}<br><strong>Evento:</strong> ${escapeHtml(eventId || "No informado")}<br><strong>Ticket:</strong> ${escapeHtml(ticketId || "No informado")}<br><strong>Motivo:</strong> ${escapeHtml(category)}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p><p><small>Referencia de soporte: ${supportRequest.id}</small></p>`, 
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
