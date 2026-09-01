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

  // Los links externos no tienen external_reference de nuestra app.
  // Se registran para revisión manual y nunca confirman tickets automáticamente.
  if (!ticketIds.length) {
    const { error: notificationError } = await supabase.from("external_payment_notifications").upsert({
      payment_id: String(paymentId),
      producer_id: connection.producer_id,
      status: "pending_review",
      amount: payment.transaction_amount ?? null,
      currency: payment.currency_id ?? null,
      payer_email: payment.payer?.email ?? null,
      payment_date: payment.date_approved ?? payment.date_created ?? null,
      raw_status: payment.status ?? null,
    }, { onConflict: "payment_id" })

    if (notificationError) {
      console.error("[v0] No se pudo registrar pago externo:", notificationError)
      return NextResponse.json({ error: "No se pudo registrar el pago" }, { status: 500 })
    }

    const { data: organizer } = await supabase.from("profiles").select("email, full_name").eq("id", connection.producer_id).maybeSingle()
    if (organizer?.email && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend")
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
          to: organizer.email,
          subject: "Pago recibido por link externo — requiere revisión",
          html: `<p>Hola ${organizer.full_name || ""},</p><p>Mercado Pago informó un pago recibido por un link externo.</p><ul><li><strong>Importe:</strong> ${payment.transaction_amount ?? "No informado"} ${payment.currency_id ?? ""}</li><li><strong>Payment ID:</strong> ${String(paymentId)}</li><li><strong>Estado:</strong> ${payment.status ?? "No informado"}</li><li><strong>Email del pagador:</strong> ${payment.payer?.email ?? "No informado"}</li></ul><p>Revisá el pago en Mercado Pago y confirmá manualmente la entrada si corresponde.</p>`,
        })
      } catch (emailError) {
        console.error("[v0] No se pudo enviar aviso de pago externo:", emailError)
      }
    }
    return NextResponse.json({ received: true, requires_review: true })
  }

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
  const { error: processError } = await supabase.rpc("process_mercadopago_payment", {
    p_ticket_ids: ticketIds,
    p_payment_id: String(paymentId),
    p_payment_status: status,
  })
  if (processError) {
    console.error("[v0] Error procesando pago de Mercado Pago:", processError)
    return NextResponse.json({ error: "No se pudo procesar el pago" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
