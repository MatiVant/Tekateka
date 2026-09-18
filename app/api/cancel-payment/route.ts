import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const { token } = await request.json()
  if (typeof token !== "string" || token.length < 20) return NextResponse.json({ error: "Enlace inválido" }, { status: 400 })
  const supabase = createClient()
  const hash = createHash("sha256").update(token).digest("hex")
  const { data: ticket } = await supabase.from("tickets").select("id, payment_status").eq("payment_resume_token_hash", hash).maybeSingle()
  if (!ticket) return NextResponse.json({ error: "Enlace inválido o vencido" }, { status: 404 })
  if (["approved", "confirmed"].includes(ticket.payment_status)) return NextResponse.json({ error: "Esta compra ya fue confirmada" }, { status: 409 })
  const { error } = await supabase.from("tickets").update({ status: "rejected", payment_status: "rejected" }).eq("payment_resume_token_hash", hash)
  if (error) return NextResponse.json({ error: "No se pudo cancelar la reserva" }, { status: 500 })
  return NextResponse.json({ ok: true })
}

