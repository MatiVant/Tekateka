import { Resend } from "resend"
import { createClient } from "@/lib/supabase/admin"
import { formatArgentinaDateTime } from "@/lib/date"
import { EMAIL_CONFIG } from "@/lib/email-config"
import { redactForLog } from "@/lib/mask-personal-data"

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// Mail de "solicitud recibida": todavía no es una entrada, no lleva QR.
export async function sendApprovalRequestEmail(params: {
  eventId: string
  buyerName: string
  buyerEmail: string
  quantity: number
}) {
  if (!process.env.RESEND_API_KEY) return { sent: false as const, reason: "missing_api_key" }

  try {
    const supabase = createClient()
    const { data: event } = await supabase.from("events").select("title, event_date").eq("id", params.eventId).maybeSingle()
    if (!event) return { sent: false as const, reason: "event_not_found" }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tekateka.com.ar").replace(/\/$/, "")
    const entradas = params.quantity === 1 ? "entrada" : `${params.quantity} entradas`
    const title = escapeHtml(event.title)

    const result = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      replyTo: EMAIL_CONFIG.replyTo,
      to: params.buyerEmail,
      subject: `Recibimos tu solicitud: ${event.title}`,
      html: `<p>Hola ${escapeHtml(params.buyerName)},</p><p>Recibimos tu solicitud de ${entradas} para <strong>${title}</strong>. <strong>Todavía no es una entrada confirmada</strong>: el organizador tiene que aprobarla.</p><p><strong>Fecha y hora: ${formatArgentinaDateTime(event.event_date)}</strong></p><p>Cuando la apruebe te mandamos otro mail con el código QR, y también vas a poder verla en <a href="${siteUrl}/my-tickets">Mis entradas</a>. Hasta entonces no sirve para ingresar.</p><p style="color:#666;font-size:12px">Este correo es automático y no recibe respuestas. Si tenés dudas, escribinos a <a href="mailto:${EMAIL_CONFIG.supportEmail}">${EMAIL_CONFIG.supportEmail}</a>.</p>`,
    })
    if (result.error) {
      console.error("[email] Resend rechazó el mail de solicitud recibida:", { message: result.error.message })
      return { sent: false as const, reason: "resend_error" }
    }
    return { sent: true as const }
  } catch (error) {
    console.error("[email] No se pudo enviar el mail de solicitud recibida:", redactForLog(error))
    return { sent: false as const, reason: "exception" }
  }
}
