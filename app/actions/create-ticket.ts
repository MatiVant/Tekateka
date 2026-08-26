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
}

export async function createTicket(data: CreateTicketData) {
  const supabase = createClient()

  try {
    console.log("[v0] Server Action - Creando ticket:", data)

    // Crear el ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        event_id: data.event_id,
        tier_id: data.tier_id,
        buyer_name: data.buyer_name,
        buyer_email: data.buyer_email,
        qr_code: data.qr_code,
        final_price: data.final_price,
        status: "pending",
      })
      .select()
      .single()

    if (ticketError) {
      console.error("[v0] Error al crear ticket:", ticketError)
      throw new Error(`Error al crear ticket: ${ticketError.message}`)
    }

    console.log("[v0] Ticket creado exitosamente:", ticket.id)

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
          ticket_id: ticket.id,
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

    return ticket
  } catch (error) {
    console.error("[v0] Error en createTicket:", error)
    throw error
  }
}
