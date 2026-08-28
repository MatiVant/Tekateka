import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { createClient } from "@/lib/supabase/admin"
import { getProducerAccessToken } from "@/lib/mercadopago"

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const paymentId = payload?.data?.id ?? payload?.id
  if (!paymentId) return NextResponse.json({ received: true })
  const signature = request.headers.get("x-signature")
  const requestId = request.headers.get("x-request-id") ?? ""
  const ts = signature?.match(/(?:^|,)ts=([^,]+)/)?.[1]
  const v1 = signature?.match(/(?:^|,)v1=([^,]+)/)?.[1]
  const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "").update(manifest).digest("hex")
  if (!ts || !v1 || expected.length !== v1.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) return NextResponse.json({ error: "Firma inválida" }, { status: 401 })
  if (Date.now() - Number(ts) * 1000 > 5 * 60 * 1000) return NextResponse.json({ error: "Webhook expirado" }, { status: 401 })

  const supabase = await createClient()
  const mpUserId = payload?.user_id ?? payload?.user_id?.toString()
  if (!mpUserId) return NextResponse.json({ received: true })

  const { data: connection } = await supabase
    .from("mercadopago_connections")
    .select("producer_id")
    .eq("mp_user_id", String(mpUserId))
    .maybeSingle()
  if (!connection?.producer_id) return NextResponse.json({ received: true })

  const accessToken = await getProducerAccessToken(connection.producer_id)
  if (!accessToken) return NextResponse.json({ received: true })

  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!paymentResponse.ok) return NextResponse.json({ received: true })
  const payment = await paymentResponse.json()
  const ticketIds = String(payment.external_reference || "").split(",").filter(Boolean)
  if (!ticketIds.length) return NextResponse.json({ received: true })

  const { data: matchingTickets } = await supabase
    .from("tickets")
    .select("id, event_id, events!inner(organizer_id)")
    .in("id", ticketIds)
  if (!matchingTickets?.length || matchingTickets.length !== ticketIds.length) return NextResponse.json({ received: true })
  const eventIds = new Set(matchingTickets.map((ticket) => ticket.event_id))
  if (eventIds.size !== 1) return NextResponse.json({ received: true })
  const organizerIds = new Set(matchingTickets.map((ticket) => {
    const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
    return event?.organizer_id
  }))
  if (organizerIds.size !== 1 || !organizerIds.has(connection.producer_id)) return NextResponse.json({ received: true })

  const status = payment.status === "approved"
    ? "approved"
    : payment.status === "rejected" || payment.status === "cancelled"
      ? "rejected"
      : "pending"
  await supabase
    .from("tickets")
    .update({
      payment_id: String(paymentId),
      payment_status: status,
      paid_at: status === "approved" ? new Date().toISOString() : null,
    })
    .in("id", ticketIds)
    .eq("payment_provider", "mercadopago")
  return NextResponse.json({ received: true })
}
