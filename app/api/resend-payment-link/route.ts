import { createHash, randomBytes } from "node:crypto"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: Request) {
  try {
    const { ticketId } = await request.json()
    if (typeof ticketId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketId)) return NextResponse.json({ error: "Ticket ID inválido" }, { status: 400 })
    const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])
    if (!authorized || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    if (!resend) return NextResponse.json({ error: "Servicio de email no configurado" }, { status: 500 })

    const supabase = createClient()
    const { data: ticket, error } = await supabase.from("tickets").select("id, buyer_name, buyer_email, status, payment_status, payment_resume_expires_at, events(organizer_id, title)").eq("id", ticketId).single()
    if (error || !ticket) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 })
    const linkedEvent = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
    if (profile?.role !== "superadmin" && linkedEvent?.organizer_id !== user.id) return NextResponse.json({ error: "No tenés permiso para reenviar este enlace" }, { status: 403 })
    if (ticket.status === "confirmed" || ticket.payment_status === "approved") return NextResponse.json({ error: "Esta entrada ya está confirmada" }, { status: 409 })

    const token = randomBytes(32).toString("hex")
    const hash = createHash("sha256").update(token).digest("hex")
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const { error: updateError } = await supabase.from("tickets").update({ payment_resume_token_hash: hash, payment_resume_expires_at: expiresAt }).eq("id", ticket.id)
    if (updateError) return NextResponse.json({ error: "No se pudo generar el enlace" }, { status: 500 })

    const requestHeaders = await headers()
    const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || process.env.VERCEL_URL
    const proto = requestHeaders.get("x-forwarded-proto") || "https"
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : "http://localhost:3000")
    const resumeUrl = `${baseUrl.replace(/\/$/, "")}/pay/${token}`
    const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
    const result = await resend.emails.send({
      from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
      to: ticket.buyer_email,
      subject: `Enlace para continuar tu compra: ${event?.title || "tu evento"}`,
      html: `<p>Hola ${ticket.buyer_name},</p><p>Te reenviamos el enlace para continuar con el pago de tu entrada para <strong>${event?.title || "tu evento"}</strong>:</p><p><a href="${resumeUrl}">Continuar con mi compra</a></p><p>El enlace es privado y válido durante 48 horas.</p><hr /><p style="font-size:12px;color:#666">Este correo es automático y no recibe respuestas. Si tenés dudas, escribinos a <a href="mailto:consultas@tekateka.com.ar">consultas@tekateka.com.ar</a>.</p>`,
    })
    if (result.error) return NextResponse.json({ error: "No se pudo enviar el email" }, { status: 502 })
    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error("[v0] Error reenviando enlace de pago:", error)
    return NextResponse.json({ error: "No se pudo reenviar el enlace" }, { status: 500 })
  }
}
