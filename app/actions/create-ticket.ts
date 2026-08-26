"use server"

import { createClient } from "@/lib/supabase/admin"

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

      // Solo enviar email si NO estamos en modo de prueba o si el destinatario es el admin
      const isTestMode = data.buyer_email === "mtrovant@gmail.com"

      if (!isTestMode) {
        console.log("[v0] Enviando email de confirmación de compra...")
        // Aquí iría la lógica de envío de email cuando esté configurado
      } else {
        console.log("[v0] Email en modo prueba - Link de pago:", event?.mercado_pago_link)
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
