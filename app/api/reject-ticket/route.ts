import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: NextRequest) {
  try {
    const { ticketId, reason } = await request.json()

    if (!ticketId || !reason) {
      return NextResponse.json({ error: "Ticket ID y motivo son requeridos" }, { status: 400 })
    }

    const supabase = createClient()

    // Obtener información del ticket y comprador
    const { data: ticket, error: fetchError } = await supabase
      .from("tickets")
      .select(`
        *,
        events (
          title,
          price,
          event_date,
          venue
        )
      `)
      .eq("id", ticketId)
      .single()

    if (fetchError || !ticket) {
      console.error("[v0] Error al obtener ticket:", fetchError)
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
    }

    if (ticket.status === "cancelled") {
      return NextResponse.json({ error: "La entrada ya estaba cancelada" }, { status: 409 })
    }

    const { data: ticketPromotion } = await supabase
      .from("ticket_promotions")
      .select("promotion_code_id")
      .eq("ticket_id", ticketId)
      .maybeSingle()

    // Actualizar el ticket con estado rechazado y motivo
    const { error: updateError } = await supabase
      .from("tickets")
      .update({
        status: "cancelled",
        rejection_reason: reason,
      })
      .eq("id", ticketId)

    if (updateError) {
      console.error("[v0] Error al rechazar ticket:", updateError)
      return NextResponse.json({ error: "Error al rechazar el ticket" }, { status: 500 })
    }

    if (ticketPromotion?.promotion_code_id) {
      const { data: promotion } = await supabase
        .from("promotion_codes")
        .select("current_uses")
        .eq("id", ticketPromotion.promotion_code_id)
        .single()
      if (promotion) {
        await supabase
          .from("promotion_codes")
          .update({ current_uses: Math.max(0, Number(promotion.current_uses || 0) - 1) })
          .eq("id", ticketPromotion.promotion_code_id)
      }
    }

    if (!resend) {
      return NextResponse.json({ success: true, warning: "Email no configurado" })
    }

    try {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
        to: ticket.buyer_email,
        subject: `❌ Tu pago para ${ticket.events.title} no pudo ser verificado`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
                .reason-box { background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0; font-size: 28px;">⚠️ Pago No Verificado</h1>
                  <p style="margin: 10px 0 0 0; opacity: 0.9;">Necesitamos que verifiques tu comprobante</p>
                </div>
                <div class="content">
                  <p>Hola <strong>${ticket.buyer_name}</strong>,</p>
                  <p>Lamentablemente, no pudimos verificar tu pago para el evento <strong>${ticket.events.title}</strong>.</p>
                  
                  <div class="reason-box">
                    <h3 style="margin-top: 0; color: #dc2626;">Motivo del rechazo:</h3>
                    <p style="margin: 0; font-size: 16px;"><strong>${reason}</strong></p>
                  </div>

                  ${
                    ticket.payment_receipt_url
                      ? `
                  <div class="info-box">
                    <h3 style="margin-top: 0; color: #6366f1;">📎 Comprobante enviado:</h3>
                    <img src="${ticket.payment_receipt_url}" alt="Comprobante" style="max-width: 100%; border-radius: 8px; margin-top: 10px;" />
                  </div>
                  `
                      : ""
                  }

                  <div class="info-box">
                    <h3 style="margin-top: 0; color: #6366f1;">¿Qué puedes hacer?</h3>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                      <li>Verifica que el comprobante de pago sea correcto y esté completo</li>
                      <li>Asegúrate de que el monto pagado coincida con el precio de la entrada</li>
                      <li>Si el problema persiste, contacta con nosotros respondiendo a este email</li>
                    </ul>
                  </div>

                  <p>Si crees que esto es un error o necesitas ayuda, no dudes en contactarnos.</p>
                  
                  <div class="footer">
                    <p>Este email fue enviado por <strong>TekaTeka</strong></p>
                    <p>Responde a este email si tienes alguna consulta.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      })

      if (emailError) {
        console.error("[v0] Error al enviar email de rechazo:", emailError)
      } else {
        console.log("[v0] Email de rechazo enviado exitosamente:", emailData)
      }
    } catch (emailError) {
      console.error("[v0] Error al enviar email de rechazo:", emailError)
    }

    return NextResponse.json({
      success: true,
      message: "Ticket rechazado y email enviado",
    })
  } catch (error) {
    console.error("[v0] Error en reject-ticket:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
