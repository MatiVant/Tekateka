import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { createClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const { token, qrCode } = await request.json()
    if (typeof token !== "string" || typeof qrCode !== "string" || !token || !qrCode) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
    const supabase = createClient()
    const { data: link } = await supabase.from("ticket_checker_links").select("id, organizer_id, expires_at, revoked_at").eq("token_hash", tokenHash).maybeSingle()
    if (!link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Link vencido o inválido" }, { status: 401 })

    const { data: ticket } = await supabase.from("tickets").select("*, events(id, title, event_date, venue, organizer_id)").eq("qr_code", qrCode.trim()).maybeSingle()
    if (!ticket || !ticket.events || ticket.events.organizer_id !== link.organizer_id) return NextResponse.json({ error: "Código QR no válido para este organizador" }, { status: 404 })
    if (ticket.status === "used") return NextResponse.json({ type: "warning", message: "Este ticket ya fue utilizado anteriormente.", ticket }, { status: 200 })
    if (ticket.status === "cancelled") return NextResponse.json({ type: "error", message: "Este ticket fue cancelado.", ticket }, { status: 200 })
    if (ticket.status === "pending") return NextResponse.json({ type: "warning", message: "Ticket pendiente de confirmación.", ticket }, { status: 200 })

    const { error } = await supabase.from("tickets").update({ status: "used", verified_at: new Date().toISOString(), verified_by: null }).eq("id", ticket.id).eq("status", "confirmed")
    if (error) throw error
    return NextResponse.json({ type: "success", message: "Ticket válido. Entrada verificada correctamente.", ticket: { ...ticket, status: "used" } })
  } catch {
    return NextResponse.json({ error: "No se pudo verificar el ticket" }, { status: 500 })
  }
}
