import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const { ticketId } = await request.json()
    if (typeof ticketId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
      return NextResponse.json({ error: "Ticket ID inválido" }, { status: 400 })
    }

    const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])
    if (!authorized || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const supabase = createClient()
    const { data: ticket, error: fetchError } = await supabase
      .from("tickets")
      .select("id, event_id, tier_id, status, payment_status, rejection_reason, events(id, organizer_id, available_tickets), ticket_promotions(promotion_code_id)")
      .eq("id", ticketId)
      .maybeSingle()

    if (fetchError || !ticket) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 })
    const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
    if (!event || (profile?.role !== "superadmin" && event.organizer_id !== user.id)) {
      return NextResponse.json({ error: "No tenés permiso para recuperar esta entrada" }, { status: 403 })
    }
    if (ticket.status !== "cancelled" || !ticket.rejection_reason) {
      return NextResponse.json({ error: "La entrada no figura como rechazada" }, { status: 409 })
    }

    const restoredStatus = ticket.payment_status === "approved" ? "confirmed" : "pending"
    let eventInventoryRestored = false
    let tierInventoryRestored = false

    if (restoredStatus === "confirmed") {
      const availableTickets = Number(event.available_tickets ?? 0)
      if (availableTickets < 1) {
        return NextResponse.json({ error: "No hay cupos disponibles para recuperar esta entrada" }, { status: 409 })
      }

      const { data: updatedEvent, error: eventError } = await supabase
        .from("events")
        .update({ available_tickets: availableTickets - 1 })
        .eq("id", event.id)
        .gt("available_tickets", 0)
        .select("id")
        .maybeSingle()
      if (eventError || !updatedEvent) {
        return NextResponse.json({ error: "No se pudo reservar nuevamente el cupo del evento" }, { status: 409 })
      }
      eventInventoryRestored = true

      if (ticket.tier_id) {
        const { data: tier } = await supabase
          .from("ticket_tiers")
          .select("available_quantity")
          .eq("id", ticket.tier_id)
          .maybeSingle()
        if (!tier || Number(tier.available_quantity ?? 0) < 1) {
          await supabase.from("events").update({ available_tickets: availableTickets }).eq("id", event.id)
          return NextResponse.json({ error: "No hay cupos disponibles en la categoría de esta entrada" }, { status: 409 })
        }

        const { data: updatedTier, error: tierError } = await supabase
          .from("ticket_tiers")
          .update({ available_quantity: Number(tier.available_quantity) - 1 })
          .eq("id", ticket.tier_id)
          .gt("available_quantity", 0)
          .select("id")
          .maybeSingle()
        if (tierError || !updatedTier) {
          await supabase.from("events").update({ available_tickets: availableTickets }).eq("id", event.id)
          return NextResponse.json({ error: "No se pudo reservar nuevamente el cupo de la categoría" }, { status: 409 })
        }
        tierInventoryRestored = true
      }
    }

    const { data: restoredTicket, error: updateError } = await supabase
      .from("tickets")
      .update({ status: restoredStatus, rejection_reason: null })
      .eq("id", ticket.id)
      .eq("status", "cancelled")
      .not("rejection_reason", "is", null)
      .select("id")
      .maybeSingle()

    if (updateError || !restoredTicket) {
      if (tierInventoryRestored && ticket.tier_id) {
        const { data: tier } = await supabase.from("ticket_tiers").select("available_quantity").eq("id", ticket.tier_id).maybeSingle()
        if (tier) await supabase.from("ticket_tiers").update({ available_quantity: Number(tier.available_quantity) + 1 }).eq("id", ticket.tier_id)
      }
      if (eventInventoryRestored) {
        await supabase.from("events").update({ available_tickets: Number(event.available_tickets) }).eq("id", event.id)
      }
      return NextResponse.json({ error: "La entrada cambió de estado. Actualizá la página e intentá nuevamente." }, { status: 409 })
    }

    const promotions = Array.isArray(ticket.ticket_promotions) ? ticket.ticket_promotions : ticket.ticket_promotions ? [ticket.ticket_promotions] : []
    for (const promotion of promotions) {
      const { data: code } = await supabase.from("promotion_codes").select("current_uses").eq("id", promotion.promotion_code_id).maybeSingle()
      if (code) {
        await supabase.from("promotion_codes").update({ current_uses: Number(code.current_uses ?? 0) + 1 }).eq("id", promotion.promotion_code_id)
      }
    }

    return NextResponse.json({ success: true, status: restoredStatus, emailSent: false })
  } catch (error) {
    console.error("[v0] Error al recuperar entrada rechazada:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
