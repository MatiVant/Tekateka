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
  const { data: ticket } = await supabase.from("tickets").select("id, event_id, events!inner(organizer_id)").eq("payment_id", String(paymentId)).maybeSingle()
  if (!ticket) return NextResponse.json({ received: true })
  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  const accessToken = await getProducerAccessToken(event.organizer_id)
  if (!accessToken) return NextResponse.json({ received: true })

  const { data: payment } = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.ok ? r.json() : null)
  if (!payment) return NextResponse.json({ received: true })
  const status = payment.status === "approved" ? "approved" : payment.status === "rejected" || payment.status === "cancelled" ? "rejected" : "pending"
  await supabase.from("tickets").update({ payment_status: status, paid_at: status === "approved" ? new Date().toISOString() : null }).eq("id", ticket.id)
  return NextResponse.json({ received: true })
}
