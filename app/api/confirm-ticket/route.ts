import { createClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { Resend } from "resend"
import QRCode from "qrcode"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const ticketIds = Array.isArray(body.ticketIds) ? body.ticketIds.filter(Boolean) : body.ticketId ? [body.ticketId] : []

    if (ticketIds.length === 0) {
      return NextResponse.json({ error: "Ticket ID requerido" }, { status: 400 })
    }

    const supabase = createClient()

    const { data: tickets, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        *,
        events (
          title,
          event_date,
          venue,
          description,
          organizer_id
        )
      `)
      .in("id", ticketIds)

    const ticket = tickets?.[0]
    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
    }

    const { data: purchaseTickets } = ticket.payment_resume_token_hash
      ? await supabase.from("tickets").select("*").eq("payment_resume_token_hash", ticket.payment_resume_token_hash).eq("event_id", ticket.event_id)
      : { data: [ticket] }
    const groupedTickets = purchaseTickets?.length ? purchaseTickets : [ticket]
    const pendingTickets = groupedTickets.filter((item) => item.status !== "confirmed")
    const wasAlreadyConfirmed = pendingTickets.length === 0
    if (wasAlreadyConfirmed) {
      return NextResponse.json({ success: true, alreadyConfirmed: true, message: "La entrada ya estaba aprobada" })
    }
    const { error: updateError } = await supabase.from("tickets").update({ status: "confirmed", payment_status: "approved" }).in("id", groupedTickets.map((item) => item.id))

    if (updateError) throw updateError

    if (!wasAlreadyConfirmed) {
      const { data: event } = await supabase.from("events").select("total_tickets").eq("id", ticket.event_id).single()
      if (event) {
        const { count: confirmedCount } = await supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", ticket.event_id).eq("status", "confirmed")
        await supabase.from("events").update({ available_tickets: Math.max(0, Number(event.total_tickets) - (confirmedCount ?? 0)) }).eq("id", ticket.event_id)
      }
      if (ticket.tier_id) {
        const { data: tier } = await supabase.from("ticket_tiers").select("available_quantity").eq("id", ticket.tier_id).single()
        if (tier && Number(tier.available_quantity) > 0) {
          await supabase.from("ticket_tiers").update({ available_quantity: Number(tier.available_quantity) - 1 }).eq("id", ticket.tier_id)
        }
      }
    }

    if (!resend) {
      return NextResponse.json({ success: true, warning: "Email no configurado" })
    }

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tktk.buholabs.com.ar"
      const adminTicketsUrl = `${siteUrl}/admin/events/${ticket.event_id}/tickets`
      const qrCards = groupedTickets.map((groupTicket) => {
        const groupTicketUrl = `${siteUrl}/ticket/${encodeURIComponent(groupTicket.qr_code)}`
        const groupQrImageUrl = `${siteUrl}/api/generate-qr?code=${encodeURIComponent(groupTicketUrl)}`
        return `<div class="qr-container"><h2 style="color:#6366f1">Entrada</h2><p>Presentá este código al ingresar:</p><img src="${groupQrImageUrl}" alt="Código QR" class="qr-code" width="280" height="280" /><p>Código: <span class="code">${groupTicket.qr_code}</span></p><p><a href="${groupTicketUrl}">Abrir entrada digital</a></p></div>`
      }).join("")

      const { data: organizer } = await supabase.from("profiles").select("email").eq("id", ticket.events.organizer_id).maybeSingle()
      const recipients = [ticket.buyer_email, organizer?.email].filter((email, index, list): email is string => Boolean(email) && list.indexOf(email) === index)

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
        to: recipients,
        subject: `Tu entrada está confirmada: ${ticket.events.title}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #f4eddf; color: #171717; padding: 18px 0 22px; text-align: left; border-bottom: 4px solid #f4511e; }
                .content { background: #fffdf7; padding: 30px; border: 1px solid #e7dcc8; border-radius: 0 0 18px 18px; }
                .qr-container { text-align: center; margin: 30px 0; padding: 24px; background: #ffffff; border: 1px solid #e7dcc8; border-radius: 16px; }
                .qr-code { width: 280px; height: 280px; margin: 20px auto; display: block; }
                .info-box { background: #f4eddf; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #f4511e; }
                .footer { text-align: center; color: #6b6258; font-size: 14px; margin-top: 30px; }
                .code { font-family: monospace; font-size: 18px; font-weight: bold; color: #f4511e; background: #f4eddf; padding: 10px; border-radius: 6px; display: inline-block; }
              </style>
            </head>
            <body style="margin:0;background:#f4eddf;color:#171717;font-family:Arial,sans-serif;">
              <div class="container" style="max-width:620px;margin:0 auto;padding:28px 18px;">
                <div class="header" style="background:#f4eddf;color:#171717;padding:12px 0 22px;text-align:left;border-bottom:4px solid #f4511e;">
                  <img src="${process.env.NEXT_PUBLIC_SITE_URL || "https://tktk.buholabs.com.ar"}/tekateka-logo.png" alt="TekaTeka — Tus eventos. Tus entradas." width="220" style="display:block;width:220px;height:auto;">
                </div>
                <div class="content">
                  <p>Hola <strong>${ticket.buyer_name}</strong>,</p>
                  <p>¡Excelentes noticias! Tu pago ha sido confirmado y tu entrada está lista.</p>
                  
                  <div class="info-box">
                    <h2 style="margin-top: 0; color: #6366f1;">📅 Detalles del Evento</h2>
                    <p><strong>Evento:</strong> ${ticket.events.title}</p>
                    <p><strong>Fecha:</strong> ${new Date(ticket.events.event_date).toLocaleString("es-AR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Argentina/Buenos_Aires",
                    })}</p>
                    <p><strong>Lugar:</strong> ${ticket.events.venue}</p>
                  </div>

${qrCards}
                  <p style="font-size: 14px; color: #6b7280; margin-top: 15px;">Guardá este email o tomá una captura de pantalla de cada código QR.</p>

                  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e;">
                      <strong>⚠️ Importante:</strong> Este código QR es único y personal. No lo compartas con nadie.
                    </p>
                  </div>

                  <p>¡Nos vemos en el evento! 🎊</p>
                  
                  <div class="footer">
                    <p>Este email fue enviado por <strong>TekaTeka</strong></p>
                    <p><a href="${adminTicketsUrl}" style="display:inline-block;background:#f4511e;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir entradas del evento</a></p><p>Este correo es automático y no recibe respuestas. Si tenés dudas, escribinos a <a href="mailto:consultas@tekateka.com.ar">consultas@tekateka.com.ar</a>.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      })

      if (emailError) {
        console.error("[v0] Error al enviar email:", emailError)
        return NextResponse.json({
          success: true,
          warning: "Ticket confirmado pero el email no pudo ser enviado",
          error: emailError.message,
        })
      }

      console.log("[v0] Email enviado exitosamente:", emailData)

      return NextResponse.json({
        success: true,
        message: "Ticket confirmado y email enviado exitosamente",
        emailId: emailData?.id,
      })
    } catch (emailError: any) {
      console.error("[v0] Error al enviar email:", emailError)
      return NextResponse.json({
        success: true,
        warning: "Ticket confirmado pero el email no pudo ser enviado",
        error: emailError.message,
      })
    }
  } catch (error: any) {
    console.error("[v0] Error al confirmar ticket:", error)
    return NextResponse.json({ error: "Error al confirmar ticket", details: error.message }, { status: 500 })
  }
}
