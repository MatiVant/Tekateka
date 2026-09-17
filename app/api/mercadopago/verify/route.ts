import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { getProducerAccessToken } from "@/lib/mercadopago"

export async function POST(request: Request) {
  const { ticketId } = await request.json().catch(() => ({}))
  if (!ticketId) return NextResponse.json({ error: "Entrada inválida" }, { status: 400 })

  const supabase = await createClient()
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, event_id, payment_id, mercado_pago_reference, events!inner(organizer_id)")
    .eq("id", ticketId)
    .maybeSingle()
  if (!ticket) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 })

  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  const accessToken = await getProducerAccessToken(event.organizer_id)
  if (!accessToken) return NextResponse.json({ error: "Mercado Pago no está conectado" }, { status: 409 })

  let payment: any = null
  if (ticket.payment_id) {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(ticket.payment_id)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
    if (response.ok) payment = await response.json()
  }
  if (!payment && ticket.mercado_pago_reference) {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(ticket.id)}&sort=date_created&criteria=desc&limit=1`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
    if (response.ok) payment = (await response.json()).results?.[0] ?? null
  }
  if (!payment) return NextResponse.json({ status: "not_found", message: "Mercado Pago todavía no informó un pago para esta entrada." })

  const normalizedStatus = payment.status === "approved" ? "approved" : payment.status === "rejected" || payment.status === "cancelled" ? "rejected" : "pending"
  const update: Record<string, unknown> = { payment_id: String(payment.id), payment_provider: "mercadopago", payment_status: normalizedStatus }
  if (normalizedStatus === "approved") update.status = "confirmed"
  const { error } = await supabase.from("tickets").update(update).eq("id", ticket.id)
  if (error) return NextResponse.json({ error: "No se pudo actualizar la entrada" }, { status: 500 })

  return NextResponse.json({ status: normalizedStatus, paymentId: String(payment.id), mpStatus: payment.status })
}
