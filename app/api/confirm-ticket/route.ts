import { createClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawTicketIds = Array.isArray(body.ticketIds) ? body.ticketIds : body.ticketId ? [body.ticketId] : []
    const ticketIds = [...new Set(rawTicketIds.filter((id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))]
    if (ticketIds.length === 0 || ticketIds.length !== rawTicketIds.length) {
      return NextResponse.json({ error: "Ticket ID inválido" }, { status: 400 })
    }

    const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])
    if (!authorized || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const supabase = createClient()
    const { data: tickets, error: ticketError } = await supabase
      .from("tickets")
      .select("*, events(id, organizer_id, title, event_date, venue, description)")
      .in("id", ticketIds)

    if (ticketError || !tickets?.length || tickets.length !== ticketIds.length) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
    }

    const eventFor = (item: (typeof tickets)[number]) => Array.isArray(item.events) ? item.events[0] : item.events
    const unauthorizedTicket = tickets.some((item) => {
      const event = eventFor(item)
      return !event || (profile?.role !== "superadmin" && event.organizer_id !== user.id)
    })
    if (unauthorizedTicket) return NextResponse.json({ error: "No tenés permiso para confirmar estas entradas" }, { status: 403 })

    const ticket = tickets[0]
    const purchaseTicketsResult = ticket.payment_resume_token_hash
      ? await supabase.from("tickets").select("*").eq("payment_resume_token_hash", ticket.payment_resume_token_hash).eq("event_id", ticket.event_id)
      : ticketIds.length > 1
        ? await supabase.from("tickets").select("*").in("id", ticketIds).eq("event_id", ticket.event_id).eq("buyer_email", ticket.buyer_email)
        : { data: [ticket] }
    const groupedTickets = purchaseTicketsResult.data?.length ? purchaseTicketsResult.data : [ticket]
    const pendingTickets = groupedTickets.filter((item) => item.status === "pending")
    const wasAlreadyConfirmed = pendingTickets.length === 0 && groupedTickets.every((item) => item.status === "confirmed")

    if (wasAlreadyConfirmed) {
      return NextResponse.json({ success: true, alreadyConfirmed: true, message: "La entrada ya estaba aprobada" })
    }
    if (pendingTickets.length === 0) {
      return NextResponse.json({ error: "Solo se pueden confirmar entradas pendientes" }, { status: 409 })
    }

    const { data: updatedTickets, error: updateError } = await supabase
      .from("tickets")
      .update({ status: "confirmed", payment_status: "approved" })
      .in("id", pendingTickets.map((item) => item.id))
      .eq("status", "pending")
      .select("id")

    if (updateError) throw updateError
    if (updatedTickets?.length !== pendingTickets.length) {
      return NextResponse.json({ error: "El estado de las entradas cambió. Actualizá la página e intentá nuevamente." }, { status: 409 })
    }

    const event = eventFor(ticket)
    if (event) {
      const { data: eventInventory } = await supabase.from("events").select("total_tickets").eq("id", ticket.event_id).single()
      if (eventInventory) {
        const { count: confirmedCount } = await supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", ticket.event_id).eq("status", "confirmed")
        await supabase.from("events").update({ available_tickets: Math.max(0, Number(eventInventory.total_tickets) - (confirmedCount ?? 0)) }).eq("id", ticket.event_id)
      }
      if (ticket.tier_id) {
        const { data: tier } = await supabase.from("ticket_tiers").select("available_quantity").eq("id", ticket.tier_id).single()
        if (tier && Number(tier.available_quantity) > 0) {
          await supabase.from("ticket_tiers").update({ available_quantity: Number(tier.available_quantity) - 1 }).eq("id", ticket.tier_id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Entradas confirmadas. El comprador puede consultar el estado y los códigos QR en Mis entradas.",
    })
  } catch (error: unknown) {
    console.error("[v0] Error al confirmar ticket:", error)
    return NextResponse.json({ error: "Error al confirmar ticket" }, { status: 500 })
  }
}
