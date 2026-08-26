import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { getProducerAccessToken } from "@/lib/mercadopago"

export async function POST(request: Request) {
  const { ticketId } = await request.json().catch(() => ({}))
  if (!ticketId) return NextResponse.json({ error: "ticketId requerido" }, { status: 400 })
  const supabase = await createClient()
  const { data: ticket } = await supabase.from("tickets").select("id, buyer_name, buyer_email, final_price, event_id, events!inner(title, organizer_id)").eq("id", ticketId).maybeSingle()
  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 })
  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  const accessToken = await getProducerAccessToken(event.organizer_id)
  if (!accessToken) return NextResponse.json({ error: "El productor no conectó Mercado Pago o debe reconectar su cuenta" }, { status: 409 })
  const preference = await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ title: event.title, quantity: 1, unit_price: Number(ticket.final_price) }], payer: { name: ticket.buyer_name, email: ticket.buyer_email }, external_reference: ticket.id, notification_url: `${new URL(request.url).origin}/api/mercadopago/webhook` }) })
  if (!preference.ok) return NextResponse.json({ error: "No se pudo crear el pago" }, { status: 502 })
  const data = await preference.json()
  await supabase.from("tickets").update({ payment_provider: "mercadopago", payment_id: data.id, payment_status: "pending" }).eq("id", ticket.id)
  return NextResponse.json({ initPoint: data.init_point, preferenceId: data.id })
}
