import { createClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { Resend } from "resend"
import QRCode from "qrcode"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: Request) {
  try {
    const { ticketId } = await request.json()

    if (!ticketId) {
      return NextResponse.json({ error: "Ticket ID requerido" }, { status: 400 })
    }

    const supabase = createClient()

    const { data: ticket, error: ticketError } = await supabase
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
      .eq("id", ticketId)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
    }

    const wasAlreadyConfirmed = ticket.status === "confirmed"
    const { error: updateError } = await supabase.from("tickets").update({ status: "confirmed" }).eq("id", ticketId)

    if (updateError) throw updateError

    if (!wasAlreadyConfirmed) {
      const { data: event } = await supabase.from("events").select("available_tickets").eq("id", ticket.event_id).single()
      if (event && Number(event.available_tickets) > 0) {
        await supabase.from("events").update({ available_tickets: Number(event.available_tickets) - 1 }).eq("id", ticket.event_id)
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
      const ticketUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://tktk.buholabs.com.ar"}/ticket/${encodeURIComponent(ticket.qr_code)}`
      const qrDataUrl = await QRCode.toDataURL(ticketUrl, {
        errorCorrectionLevel: "M",
        type: "image/png",
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })

      const { data: organizer } = await supabase.from("profiles").select("email").eq("id", ticket.events.organizer_id).maybeSingle()
      const recipients = [ticket.buyer_email, organizer?.email].filter((email, index, list): email is string => Boolean(email) && list.indexOf(email) === index)

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
        to: recipients,
        subject: `✅ Tu entrada para ${ticket.events.title} ha sido confirmada`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .qr-container { text-align: center; margin: 30px 0; padding: 20px; background: white; border-radius: 8px; }
                .qr-code { max-width: 400px; width: 100%; height: auto; margin: 20px auto; display: block; }
                .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
                .code { font-family: monospace; font-size: 18px; font-weight: bold; color: #6366f1; background: #f3f4f6; padding: 10px; border-radius: 4px; display: inline-block; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0; font-size: 28px;">🎉 ¡Entrada Confirmada!</h1>
                  <p style="margin: 10px 0 0 0; opacity: 0.9;">Tu pago ha sido verificado</p>
                </div>
                <div class="content">
                  <p>Hola <strong>${ticket.buyer_name}</strong>,</p>
                  <p>¡Excelentes noticias! Tu pago ha sido confirmado y tu entrada está lista.</p>
                  
                  <div class="info-box">
                    <h2 style="margin-top: 0; color: #6366f1;">📅 Detalles del Evento</h2>
                    <p><strong>Evento:</strong> ${ticket.events.title}</p>
                    <p><strong>Fecha:</strong> ${new Date(ticket.events.event_date).toLocaleDateString("es-AR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</p>
                    <p><strong>Lugar:</strong> ${ticket.events.venue}</p>
                  </div>

                  <div class="qr-container">
                    <h2 style="color: #6366f1;">🎫 Tu Código QR</h2>
                    <p>Presenta este código al ingresar al evento:</p>
                    <img src="${qrDataUrl}" alt="Código QR" class="qr-code" />
                    <p>Código: <span class="code">${ticket.qr_code}</span></p>
                    <p><a href="${ticketUrl}">Abrir mi entrada digital</a></p>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 15px;">
                      💡 Guarda este email o toma una captura de pantalla del código QR
                    </p>
                  </div>

                  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e;">
                      <strong>⚠️ Importante:</strong> Este código QR es único y personal. No lo compartas con nadie.
                    </p>
                  </div>

                  <p>¡Nos vemos en el evento! 🎊</p>
                  
                  <div class="footer">
                    <p>Este email fue enviado por <strong>TekaTeka</strong></p>
                    <p>Si tienes alguna consulta, responde a este email.</p>
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
