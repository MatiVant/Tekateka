import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { createClient } from "@/lib/supabase/admin"

type TicketDetailsRecord = {
  id: string
  buyer_name: string
  buyer_email: string
  qr_code: string
  status: string
  purchased_at: string
}

type EventDetailsRecord = {
  title: string
  event_date: string
  venue: string
}

const ticketDetails = (ticket: TicketDetailsRecord, event: EventDetailsRecord, status = ticket.status) => ({
  id: ticket.id,
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
    const body = await request.json()
    const { token, qrCode, action, email, ticketId } = body
    if (typeof token !== "string" || token.length < 40 || token.length > 200) {
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

    if (action === "door_sale") {
      const quantity = Math.floor(Number(body.quantity))
      const unitPrice = Math.round(Number(body.unitPrice) * 100) / 100
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return NextResponse.json({ error: "La cantidad debe estar entre 1 y 1.000" }, { status: 400 })
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return NextResponse.json({ error: "El precio no es válido" }, { status: 400 })
      const { error } = await supabase.from("door_sales").insert({ event_id: link.event_id, quantity, unit_price: unitPrice, buyer_name: typeof body.buyerName === "string" ? body.buyerName.trim().slice(0, 120) || null : null, buyer_note: typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null, created_by: link.organizer_id })
      if (error) throw error
      return NextResponse.json({ message: "Venta en puerta registrada." })
    }

    if (action === "list_all") {
      const { data: tickets, error } = await supabase
        .from("tickets")
        .select("id, buyer_name, buyer_email, status, purchased_at, verified_at")
        .eq("event_id", link.event_id)
        .in("status", ["confirmed", "used"])
        .order("status", { ascending: true })
        .order("buyer_name", { ascending: true })
        .order("purchased_at", { ascending: false })
        .limit(1000)
      if (error) throw error
      return NextResponse.json({ tickets: tickets ?? [] })
    }

    if (action === "search_by_email") {
      if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return NextResponse.json({ error: "Ingresá un email válido" }, { status: 400 })
      }
      const normalizedEmail = email.trim().toLowerCase()
      const literalEmailPattern = normalizedEmail.replace(/[\\%_]/g, "\\$&")
      const { data: tickets, error } = await supabase
        .from("tickets")
        .select("id, buyer_name, status, purchased_at, events!inner(organizer_id)")
        .eq("event_id", link.event_id)
        .ilike("buyer_email", literalEmailPattern)
        .eq("events.organizer_id", link.organizer_id)
        .order("purchased_at", { ascending: false })
        .limit(20)
      if (error) throw error
      return NextResponse.json({ tickets: (tickets ?? []).map(({ id, buyer_name, status, purchased_at }) => ({ id, buyer_name, status, purchased_at })) })
    }

    let ticketQuery = supabase
      .from("tickets")
      .select("id, event_id, buyer_name, buyer_email, qr_code, status, purchased_at, events(id, title, event_date, venue, organizer_id)")
      .eq("event_id", link.event_id)
    if (action === "manual_check_in") {
      if (typeof ticketId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
        return NextResponse.json({ error: "Entrada inválida" }, { status: 400 })
      }
      ticketQuery = ticketQuery.eq("id", ticketId)
    } else {
      if (typeof qrCode !== "string" || !qrCode.trim() || qrCode.length > 500) {
        return NextResponse.json({ error: "Ingresá el código de la entrada" }, { status: 400 })
      }
      let normalizedQrCode = qrCode.trim()
      try {
        const url = new URL(normalizedQrCode)
        const pathMatch = url.pathname.match(/\/ticket\/([^/]+)/i)
        normalizedQrCode = pathMatch?.[1] ?? url.searchParams.get("qr") ?? url.searchParams.get("code") ?? normalizedQrCode
      } catch {
        const pathMatch = normalizedQrCode.match(/\/ticket\/([^/?#]+)/i)
        normalizedQrCode = pathMatch?.[1] ?? normalizedQrCode
      }
      ticketQuery = ticketQuery.eq("qr_code", decodeURIComponent(normalizedQrCode).trim())
    }

    const { data: ticket } = await ticketQuery.maybeSingle()
    const event = ticket && (Array.isArray(ticket.events) ? ticket.events[0] : ticket.events)
    if (!ticket || !event || event.organizer_id !== link.organizer_id) {
      return NextResponse.json({ error: action === "manual_check_in" ? "No encontramos esa entrada para este evento" : "Código QR no válido para este evento" }, { status: 404 })
    }
    if (ticket.status === "used") {
      return NextResponse.json({ type: "warning", message: "Esta entrada ya fue utilizada anteriormente.", ticket: ticketDetails(ticket, event) })
    }
    if (ticket.status === "cancelled") {
      return NextResponse.json({ type: "error", message: "Esta entrada fue cancelada.", ticket: ticketDetails(ticket, event) })
    }
    if (ticket.status !== "confirmed") {
      return NextResponse.json({ type: "warning", message: "La entrada está pendiente de confirmación.", ticket: ticketDetails(ticket, event) })
    }

    if (action !== "check_in") {
      return NextResponse.json({ type: "success", message: "Entrada válida. Confirmá el ingreso para marcarla como usada.", ticket: ticketDetails(ticket, event, "confirmed") })
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
        return NextResponse.json({ type: "warning", message: "Esta entrada ya fue utilizada anteriormente.", ticket: ticketDetails(ticket, event, "used") })
      }
      return NextResponse.json({ error: "El estado de la entrada cambió. Volvé a verificarla." }, { status: 409 })
    }
    return NextResponse.json({ type: "success", message: action === "manual_check_in" ? "Ingreso manual registrado correctamente." : "Entrada verificada correctamente.", ticket: ticketDetails(ticket, event, "used") })
  } catch {
    return NextResponse.json({ error: "No se pudo verificar la entrada" }, { status: 500 })
  }
}
