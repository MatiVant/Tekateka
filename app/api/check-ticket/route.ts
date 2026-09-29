import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { createClient } from "@/lib/supabase/admin"

const ticketDetails = (ticket: any, event: any, status = ticket.status) => ({
  buyer_name: ticket.buyer_name,
  buyer_email: ticket.buyer_email,
  qr_code: ticket.qr_code,
  status,
  purchased_at: ticket.purchased_at,
  events: {
    title: event.title,
    event_date: event.event_date,
    venue: event.venue,
  },
})

export async function POST(request: Request) {
  try {
    const { token, qrCode } = await request.json()
    if (typeof token !== "string" || typeof qrCode !== "string" || !token || !qrCode.trim() || qrCode.length > 500) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
    const supabase = createClient()
    const { data: link } = await supabase
      .from("ticket_checker_links")
      .select("id, organizer_id, event_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()
    if (!link || !link.event_id || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Link vencido o inválido" }, { status: 401 })
    }

    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, event_id, buyer_name, buyer_email, qr_code, status, purchased_at, events(id, title, event_date, venue, organizer_id)")
      .eq("event_id", link.event_id)
      .eq("qr_code", qrCode.trim())
      .maybeSingle()
    const event = ticket && (Array.isArray(ticket.events) ? ticket.events[0] : ticket.events)
    if (!ticket || !event || event.organizer_id !== link.organizer_id) {
      return NextResponse.json({ error: "Código QR no válido para este evento" }, { status: 404 })
    }
    if (ticket.status === "used") {
      return NextResponse.json({ type: "warning", message: "Este ticket ya fue utilizado anteriormente.", ticket: ticketDetails(ticket, event) })
    }
    if (ticket.status === "cancelled") {
      return NextResponse.json({ type: "error", message: "Este ticket fue cancelado.", ticket: ticketDetails(ticket, event) })
    }
    if (ticket.status !== "confirmed") {
      return NextResponse.json({ type: "warning", message: "Ticket pendiente de confirmación.", ticket: ticketDetails(ticket, event) })
    }

    const { data: updatedTicket, error } = await supabase
      .from("tickets")
      .update({ status: "used", verified_at: new Date().toISOString(), verified_by: null })
      .eq("id", ticket.id)
      .eq("event_id", link.event_id)
      .eq("status", "confirmed")
      .select("id")
      .maybeSingle()
    if (error) throw error
    if (!updatedTicket) {
      const { data: latestTicket } = await supabase
        .from("tickets")
        .select("status")
        .eq("id", ticket.id)
        .eq("event_id", link.event_id)
        .maybeSingle()
      if (latestTicket?.status === "used") {
        return NextResponse.json({ type: "warning", message: "Este ticket ya fue utilizado anteriormente.", ticket: ticketDetails(ticket, event, "used") })
      }
      return NextResponse.json({ error: "El estado del ticket cambió. Volvé a verificarlo." }, { status: 409 })
    }
    return NextResponse.json({ type: "success", message: "Ticket válido. Entrada verificada correctamente.", ticket: ticketDetails(ticket, event, "used") })
  } catch {
    return NextResponse.json({ error: "No se pudo verificar el ticket" }, { status: 500 })
  }
}
