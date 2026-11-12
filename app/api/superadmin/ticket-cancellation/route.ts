import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const { ticketId, action } = await request.json()
    if (typeof ticketId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketId) || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
    }

    const { authorized, user, profile } = await requireAuth(["superadmin"])
    if (!authorized || !user || profile?.role !== "superadmin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const supabase = createClient()
    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("id, event_id, tier_id, status, cancellation_request_status, cancellation_request_reason, events(id, available_tickets), ticket_tiers(available_quantity)")
      .eq("id", ticketId)
      .maybeSingle()

    if (error || !ticket) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 })
    if (ticket.status !== "confirmed" || ticket.cancellation_request_status !== "pending") {
      return NextResponse.json({ error: "La solicitud ya fue procesada o la entrada no está confirmada" }, { status: 409 })
    }

    const reviewedAt = new Date().toISOString()
    if (action === "reject") {
      const { data: updated, error: updateError } = await supabase
        .from("tickets")
        .update({
          cancellation_request_status: "rejected",
          cancellation_reviewed_by: user.id,
          cancellation_reviewed_at: reviewedAt,
        })
        .eq("id", ticketId)
        .eq("status", "confirmed")
        .eq("cancellation_request_status", "pending")
        .select("id")
        .maybeSingle()

      if (updateError || !updated) return NextResponse.json({ error: "La solicitud cambió de estado" }, { status: 409 })
      return NextResponse.json({ success: true, message: "Solicitud de reversión rechazada" })
    }

    const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })

    const { data: updatedEvent, error: eventError } = await supabase
      .from("events")
      .update({ available_tickets: Number(event.available_tickets || 0) + 1 })
      .eq("id", event.id)
      .select("id")
      .maybeSingle()
    if (eventError || !updatedEvent) return NextResponse.json({ error: "No se pudo liberar el cupo del evento" }, { status: 409 })

    if (ticket.tier_id) {
      const tier = Array.isArray(ticket.ticket_tiers) ? ticket.ticket_tiers[0] : ticket.ticket_tiers
      if (tier) {
        const { error: tierError } = await supabase
          .from("ticket_tiers")
          .update({ available_quantity: Number(tier.available_quantity || 0) + 1 })
          .eq("id", ticket.tier_id)
        if (tierError) {
          await supabase.from("events").update({ available_tickets: Number(event.available_tickets || 0) }).eq("id", event.id)
          return NextResponse.json({ error: "No se pudo liberar el cupo de la categoría" }, { status: 409 })
        }
      }
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from("tickets")
      .update({
        status: "cancelled",
        rejection_reason: ticket.cancellation_request_reason,
        cancellation_request_status: "approved",
        cancellation_reviewed_by: user.id,
        cancellation_reviewed_at: reviewedAt,
      })
      .eq("id", ticketId)
      .eq("status", "confirmed")
      .eq("cancellation_request_status", "pending")
      .select("id")
      .maybeSingle()

    if (updateError || !updatedTicket) {
      await supabase.from("events").update({ available_tickets: Number(event.available_tickets || 0) }).eq("id", event.id)
      return NextResponse.json({ error: "La solicitud cambió de estado" }, { status: 409 })
    }

    return NextResponse.json({ success: true, message: "Reversión aprobada y entrada cancelada" })
  } catch (error) {
    console.error("[v0] Error al revisar reversión:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
