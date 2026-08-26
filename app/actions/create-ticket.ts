"use server"

import { createClient } from "@/lib/supabase/admin"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface CreateTicketData {
  event_id: string
  tier_id: string | null
  buyer_name: string
  buyer_email: string
  qr_code: string
  promotion_code?: string
  final_price: number
  marketing_consent?: boolean
}

export async function createTicket(data: CreateTicketData) {
  const supabase = createClient()

  try {
    if (!Number.isFinite(data.final_price) || data.final_price < 0) throw new Error("Precio inválido")
    const { data: event, error: eventError } = await supabase.from("events").select("price, status, is_pay_what_you_want").eq("id", data.event_id).single()
    if (eventError || !event || event.status !== "active") throw new Error("Evento no disponible")

    let serverPrice = Number(event.price || 0)
    if (data.tier_id) {
      const { data: tier, error: tierError } = await supabase.from("ticket_tiers").select("base_price, available_quantity").eq("id", data.tier_id).eq("event_id", data.event_id).single()
      if (tierError || !tier || tier.available_quantity < 1) throw new Error("Tipo de entrada no disponible")
      serverPrice = Number(tier.base_price)
    }
    if (event.is_pay_what_you_want) serverPrice = data.final_price
    if (data.promotion_code) {
      const { data: promo } = await supabase.from("promotion_codes").select("promotion_type, discount_value, max_uses, current_uses, valid_from, valid_until, is_active").eq("event_id", data.event_id).eq("code", data.promotion_code.trim().toUpperCase()).single()
      const today = new Date().toISOString().slice(0, 10)
      if (!promo || !promo.is_active || promo.current_uses >= promo.max_uses || today < promo.valid_from || today > promo.valid_until) throw new Error("Código de promoción inválido o expirado")
      if (promo.promotion_type === "protocol") serverPrice = 0
      if (promo.promotion_type === "percentage") serverPrice = serverPrice * (1 - Number(promo.discount_value) / 100)
      if (promo.promotion_type === "fixed") serverPrice = Math.max(0, serverPrice - Number(promo.discount_value))
      if (promo.promotion_type === "2x1") serverPrice = serverPrice / 2
    }
    if (Math.abs(Number(data.final_price) - Math.max(0, serverPrice)) > 0.01) throw new Error("El precio de la compra cambió, actualizá la página")

    const { data: ticket, error: ticketError } = await supabase.rpc("create_ticket_atomic", {
      p_event_id: data.event_id,
      p_tier_id: data.tier_id,
      p_buyer_name: data.buyer_name,
      p_buyer_email: data.buyer_email,
      p_qr_code: data.qr_code,
      p_final_price: data.final_price,
      p_buyer_id: null,
      p_marketing_consent: data.marketing_consent ?? false,
    })

    if (ticketError) {
      console.error("[v0] Error al crear ticket atómico:", ticketError)
      throw new Error(ticketError.message)
    }

    const createdTicket = Array.isArray(ticket) ? ticket[0] : ticket
    if (!createdTicket) throw new Error("No se pudo crear el ticket")


    // Si hay código de promoción, guardarlo en la tabla de relación
    if (data.promotion_code) {
      const { data: promoData } = await supabase
        .from("promotion_codes")
        .select("id")
        .eq("event_id", data.event_id)
        .eq("code", data.promotion_code.toUpperCase())
        .single()

      if (promoData) {
        await supabase.from("ticket_promotions").insert({
          ticket_id: createdTicket.id,
          promotion_code_id: promoData.id,
        })

        // Incrementar el contador de usos
        await supabase.rpc("increment_promotion_uses", { promo_id: promoData.id })
      }
    }

    // Enviar email de confirmación de compra (con instrucciones de pago)
    try {
      const { data: event } = await supabase
        .from("events")
        .select("title, mercado_pago_link")
        .eq("id", data.event_id)
        .single()

      if (resend && event) {
        await resend.emails.send({
          from: "Entradas <onboarding@resend.dev>",
          to: data.buyer_email,
          subject: `Compra recibida: ${event.title}`,
          html: `<p>Hola ${data.buyer_name},</p><p>Recibimos tu reserva de entradas para <strong>${event.title}</strong>.</p><p>Tu pago queda pendiente de confirmación. Si todavía no pagaste, podés hacerlo desde la pantalla de compra.</p><p>Conservá este email: te enviaremos tus entradas cuando el pago sea confirmado.</p>`,
        })
      }
    } catch (emailError) {
      console.error("[v0] Error al enviar email:", emailError)
      // No lanzar error, el ticket ya fue creado
    }

    return createdTicket
  } catch (error) {
    console.error("[v0] Error en createTicket:", error)
    throw error
  }
}
