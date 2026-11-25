import { getEventLocation, renderEventLocationHtml } from "@/lib/event-location"
import { attendeeNameHintHtml, attendeeNameLineHtml, fetchAttendeeNamesByIds } from "@/lib/attendee-name"
import { Resend } from "resend"
import { createClient } from "@/lib/supabase/admin"
import { formatArgentinaDateTime } from "@/lib/date"
import { EMAIL_CONFIG } from "@/lib/email-config"
import { maskEmail, redactForLog } from "@/lib/mask-personal-data"

export async function sendConfirmedTicketEmail(ticketIds: string[], force = false) {
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "missing_api_key" as const }
  if (ticketIds.length === 0) return { sent: false, reason: "no_tickets" as const }

  const supabase = createClient()
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, qr_code, buyer_id, buyer_name, buyer_email, status, payment_status, event_id, purchase_group_id, events(id, title, event_date, venue, location_url, organizer_id, venues(name, address, location_url))")
    .in("id", ticketIds)

  if (error || !tickets?.length) {
    console.error("[email] No se pudieron obtener las entradas confirmadas:", redactForLog(error))
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

  let deliveryId: string | null = null
  try {
    const purchaseGroupId = firstTicket.purchase_group_id
    if (purchaseGroupId) {
      const { data: existingDelivery } = await supabase.from("ticket_email_deliveries").select("id, status").eq("purchase_group_id", purchaseGroupId).maybeSingle()
      if (existingDelivery?.status === "sent" && !force) return { sent: true, emailId: null, alreadySent: true }
      if (existingDelivery) {
        deliveryId = existingDelivery.id
        await supabase.from("ticket_email_deliveries").update({ status: "sending", error_message: null, attempts: 1, updated_at: new Date().toISOString() }).eq("id", deliveryId)
      } else {
        const { data: createdDelivery } = await supabase.from("ticket_email_deliveries").insert({ purchase_group_id: purchaseGroupId, event_id: firstTicket.event_id, buyer_email: firstTicket.buyer_email, ticket_ids: ticketIds, status: "sending", attempts: 1 }).select("id").single()
        deliveryId = createdDelivery?.id ?? null
      }
    }
  } catch (trackingError) {
    console.error("[email] No se pudo registrar el estado del envío:", redactForLog(trackingError))
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tekateka.com.ar"
  const locationHtml = renderEventLocationHtml(await getEventLocation(event))
  const attendeeNames = await fetchAttendeeNamesByIds(supabase, tickets.map((item) => item.id))
  const ticketCards = tickets.map((ticket) => {
    const ticketUrl = `${siteUrl.replace(/\/$/, "")}/ticket/${encodeURIComponent(ticket.qr_code)}`
    const qrImageUrl = `${siteUrl.replace(/\/$/, "")}/api/generate-qr?code=${encodeURIComponent(ticketUrl)}`
    return `<div style="margin:24px 0;padding:20px;background:#fff;border:1px solid #e7dcc8;border-radius:16px;text-align:center"><p><strong>Entrada</strong></p>${attendeeNameLineHtml(attendeeNames[ticket.id])}<img src="${qrImageUrl}" alt="Código QR" width="280" height="280" style="display:block;width:280px;height:280px;margin:16px auto"><p style="font-family:monospace;font-weight:bold;color:#f4511e">${ticket.qr_code}</p><p><a href="${ticketUrl}">Abrir entrada digital</a></p></div>`
  }).join("")

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: emailData, error: emailError } = await resend.emails.send({
    from: EMAIL_CONFIG.from,
    replyTo: EMAIL_CONFIG.replyTo,
    to: firstTicket.buyer_email,
    subject: `Tu entrada está confirmada: ${event.title}`,
    html: `<main style="max-width:620px;margin:0 auto;padding:28px 18px;background:#f4eddf;color:#171717;font-family:Arial,sans-serif"><h1>Tu entrada está confirmada</h1><p>Hola <strong>${firstTicket.buyer_name}</strong>, tu pago fue confirmado.</p><p><strong>${event.title}</strong><br>${formatArgentinaDateTime(event.event_date)}</p>${locationHtml}${ticketCards}<p>Guardá este email o descargá tus entradas. Los códigos QR son personales.</p>${attendeeNameHintHtml(siteUrl, Boolean(firstTicket.buyer_id))}<p style="font-size:12px;color:#6b6258">Este correo es automático. Si tenés dudas, escribinos a consultas@tekateka.com.ar.</p></main>`,
  })

  if (emailError) {
    if (deliveryId) await supabase.from("ticket_email_deliveries").update({ status: "failed", error_message: emailError.message, updated_at: new Date().toISOString() }).eq("id", deliveryId)
    console.error("[email] Error de Resend al enviar entrada confirmada:", {
      error: redactForLog(emailError),
      ticketIds,
      recipient: maskEmail(firstTicket.buyer_email),
    })
    return { sent: false, reason: "resend_error" as const, error: emailError.message }
  }

  if (deliveryId) await supabase.from("ticket_email_deliveries").update({ status: "sent", resend_id: emailData?.id ?? null, sent_at: new Date().toISOString(), error_message: null, updated_at: new Date().toISOString() }).eq("id", deliveryId)
  console.log("[email] Entrada confirmada enviada", { emailId: emailData?.id, ticketIds, recipient: maskEmail(firstTicket.buyer_email) })
  return { sent: true, emailId: emailData?.id }
}
