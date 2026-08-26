import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { getProducerAccessToken } from "@/lib/mercadopago"

export async function POST(request: Request) {
  const { ticketId, ticketIds } = await request.json().catch(() => ({}))
  const ids = Array.isArray(ticketIds) && ticketIds.length ? ticketIds : ticketId ? [ticketId] : []
  if (!ids.length || ids.length > 10) return NextResponse.json({ error: "Tickets inválidos" }, { status: 400 })
  const supabase = await createClient()
  const { data: tickets } = await supabase.from("tickets").select("id, buyer_name, buyer_email, final_price, event_id, events!inner(title, organizer_id)").in("id", ids)
  if (!tickets?.length || tickets.length !== ids.length) return NextResponse.json({ error: "Tickets no encontrados" }, { status: 404 })
  if (tickets.some((item) => Number(item.final_price) < 0)) return NextResponse.json({ error: "Importe inválido" }, { status: 400 })
  const firstTicket = tickets[0]
  const event = Array.isArray(firstTicket.events) ? firstTicket.events[0] : firstTicket.events
  if (tickets.some((item) => item.event_id !== firstTicket.event_id)) return NextResponse.json({ error: "Los tickets deben pertenecer al mismo evento" }, { status: 400 })
  const accessToken = await getProducerAccessToken(event.organizer_id)
  if (!accessToken) return NextResponse.json({ error: "El productor no conectó Mercado Pago o debe reconectar su cuenta" }, { status: 409 })
  const total = tickets.reduce((sum, item) => sum + Math.max(0, Number(item.final_price)), 0)
  const preference = await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ title: event.title, quantity: 1, unit_price: total, currency_id: "ARS" }], payer: { name: firstTicket.buyer_name, email: firstTicket.buyer_email }, external_reference: ids.join(","), notification_url: `${new URL(request.url).origin}/api/mercadopago/webhook` }) })
  if (!preference.ok) return NextResponse.json({ error: "No se pudo crear el checkout de Mercado Pago" }, { status: 502 })
  const data = await preference.json()
  await supabase.from("tickets").update({ payment_provider: "mercadopago", payment_id: data.id, payment_status: "pending" }).in("id", ids)
  return NextResponse.json({ initPoint: data.init_point, preferenceId: data.id })
}
