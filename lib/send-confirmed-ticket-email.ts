import { Resend } from "resend"
import { createClient } from "@/lib/supabase/admin"
import { formatArgentinaDateTime } from "@/lib/date"

export async function sendConfirmedTicketEmail(ticketIds: string[]) {
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "missing_api_key" as const }
  if (ticketIds.length === 0) return { sent: false, reason: "no_tickets" as const }

  const supabase = createClient()
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, qr_code, buyer_name, buyer_email, status, payment_status, event_id, events(id, title, event_date, venue, organizer_id)")
    .in("id", ticketIds)

  if (error || !tickets?.length) {
    console.error("[email] No se pudieron obtener las entradas confirmadas:", error)
    return { sent: false, reason: "tickets_not_found" as const }
  }

  const firstTicket = tickets[0]
  const event = Array.isArray(firstTicket.events) ? firstTicket.events[0] : firstTicket.events
  const samePurchase = tickets.every((ticket) => {
    const ticketEvent = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
    return ticket.buyer_email === firstTicket.buyer_email && ticket.event_id === firstTicket.event_id && ticket.status === "confirmed" && ticket.payment_status === "approved" && ticketEvent?.id === event?.id
  })
  if (!samePurchase || !event) {
    console.error("[email] Las entradas no forman una compra confirmada válida", { ticketIds })
    return { sent: false, reason: "invalid_purchase" as const }
  }

  const { data: organizer } = await supabase.from("profiles").select("email").eq("id", event.organizer_id).maybeSingle()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tktk.buholabs.com.ar"
  const ticketCards = tickets.map((ticket) => {
    const ticketUrl = `${siteUrl.replace(/\/$/, "")}/ticket/${encodeURIComponent(ticket.qr_code)}`
    const qrImageUrl = `${siteUrl.replace(/\/$/, "")}/api/generate-qr?code=${encodeURIComponent(ticketUrl)}`
    return `<div style="margin:24px 0;padding:20px;background:#fff;border:1px solid #e7dcc8;border-radius:16px;text-align:center"><p><strong>Entrada</strong></p><img src="${qrImageUrl}" alt="Código QR" width="280" height="280" style="display:block;width:280px;height:280px;margin:16px auto"><p style="font-family:monospace;font-weight:bold;color:#f4511e">${ticket.qr_code}</p><p><a href="${ticketUrl}">Abrir entrada digital</a></p></div>`
  }).join("")

  const recipients = [firstTicket.buyer_email, organizer?.email].filter((email, index, list): email is string => Boolean(email) && list.indexOf(email) === index)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: emailData, error: emailError } = await resend.emails.send({
    from: "TekaTeka <notificaciones@tktk.buholabs.com.ar>",
    to: recipients,
    subject: `Tu entrada está confirmada: ${event.title}`,
    html: `<main style="max-width:620px;margin:0 auto;padding:28px 18px;background:#f4eddf;color:#171717;font-family:Arial,sans-serif"><h1>Tu entrada está confirmada</h1><p>Hola <strong>${firstTicket.buyer_name}</strong>, tu pago fue confirmado.</p><p><strong>${event.title}</strong><br>${formatArgentinaDateTime(event.event_date)}<br>${event.venue}</p>${ticketCards}<p>Guardá este email o descargá tus entradas. Los códigos QR son personales.</p><p style="font-size:12px;color:#6b6258">Este correo es automático. Si tenés dudas, escribinos a consultas@tekateka.com.ar.</p></main>`,
  })

  if (emailError) {
    console.error("[email] Error de Resend al enviar entrada confirmada:", emailError)
    return { sent: false, reason: "resend_error" as const, error: emailError.message }
  }

  console.log("[email] Entrada confirmada enviada", { emailId: emailData?.id, ticketIds, recipient: firstTicket.buyer_email })
  return { sent: true, emailId: emailData?.id }
}
