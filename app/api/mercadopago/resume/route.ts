import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { createClient } from "@/lib/supabase/admin"
import { getProducerAccessToken } from "@/lib/mercadopago"

export async function POST(request: Request) {
  const { token } = await request.json().catch(() => ({}))
  if (typeof token !== "string" || token.length < 40) return NextResponse.json({ error: "Enlace inválido" }, { status: 400 })
  const supabase = createClient()
  const hash = createHash("sha256").update(token).digest("hex")
  const { data: ticket } = await supabase.from("tickets").select("id, buyer_name, buyer_email, final_price, event_id, payment_status, payment_resume_expires_at, mercado_pago_reference, events!inner(title, organizer_id)").eq("payment_resume_token_hash", hash).maybeSingle()
  if (!ticket || (ticket.payment_resume_expires_at && new Date(ticket.payment_resume_expires_at) < new Date())) return NextResponse.json({ error: "Este enlace venció o no es válido" }, { status: 410 })
  if (ticket.payment_status === "approved" || ticket.payment_status === "confirmed") return NextResponse.json({ error: "Esta entrada ya está confirmada" }, { status: 409 })
  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  const accessToken = await getProducerAccessToken(event.organizer_id)
  if (ticket.mercado_pago_reference) {
    const existingResponse = await fetch(`https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(ticket.mercado_pago_reference)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (existingResponse.ok) {
      const existingPreference = await existingResponse.json()
      if (existingPreference.init_point) return NextResponse.json({ initPoint: existingPreference.init_point, reused: true })
    }
  }
  if (!accessToken) return NextResponse.json({ error: "El organizador no tiene Mercado Pago conectado" }, { status: 409 })
  const origin = new URL(request.url).origin
  const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ title: event.title, quantity: 1, unit_price: Number(ticket.final_price), currency_id: "ARS" }], payer: { name: ticket.buyer_name, email: ticket.buyer_email }, external_reference: ticket.id, notification_url: `${origin}/api/mercadopago/webhook`, back_urls: { success: `${origin}/pay/${token}?payment=success`, pending: `${origin}/pay/${token}?payment=pending`, failure: `${origin}/pay/${token}?payment=failure` }, auto_return: "approved" }) })
  if (!preferenceResponse.ok) return NextResponse.json({ error: "No se pudo crear el checkout" }, { status: 502 })
  const preference = await preferenceResponse.json()
  await supabase.from("tickets").update({ payment_provider: "mercadopago", mercado_pago_reference: String(preference.id), payment_status: "pending" }).eq("id", ticket.id)
  return NextResponse.json({ initPoint: preference.init_point })
}
