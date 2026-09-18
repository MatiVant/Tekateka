import { createClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: Request) {
  try {
    const { ticketId } = await request.json()
    if (!ticketId) return NextResponse.json({ error: "Ticket ID requerido" }, { status: 400 })
    if (!resend) return NextResponse.json({ error: "El servicio de email no está configurado" }, { status: 503 })

    const supabase = createClient()
    const { data: ticket, error } = await supabase.from("tickets").select("*, events(title, event_date, venue)").eq("id", ticketId).single()
    if (error || !ticket) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 })
    if (ticket.status !== "confirmed" || ticket.payment_status !== "approved") return NextResponse.json({ error: "Solo se pueden reenviar entradas confirmadas" }, { status: 400 })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tktk.buholabs.com.ar"
    const ticketUrl = `${siteUrl.replace(/\/$/, "")}/ticket/${encodeURIComponent(ticket.qr_code)}`
    const qrImageUrl = `${siteUrl.replace(/\/$/, "")}/api/generate-qr?code=${encodeURIComponent(ticketUrl)}`
    const eventDate = new Date(ticket.events.event_date).toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

    const { error: emailError } = await resend.emails.send({
      from: "TekaTeka <notificaciones@tktk.buholabs.com.ar>",
      to: ticket.buyer_email,
      subject: `Tu entrada está confirmada: ${ticket.events.title}`,
      html: `<!doctype html><html><body style="margin:0;background:#f4eddf;color:#171717;font-family:Arial,sans-serif"><main style="max-width:620px;margin:auto;padding:28px 18px"><header style="padding:12px 0 22px;border-bottom:4px solid #f4511e"><img src="${siteUrl.replace(/\/$/, "")}/tekateka-logo.png" alt="TekaTeka — Tus eventos. Tus entradas." width="220" style="display:block;width:220px;height:auto"></header><section style="background:#fffdf7;border:1px solid #e7dcc8;border-radius:0 0 18px 18px;padding:30px;text-align:center"><p style="color:#f4511e;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Tu entrada digital</p><h1 style="font-size:30px;letter-spacing:-1px">Tu entrada está confirmada</h1><p>Hola <strong>${ticket.buyer_name}</strong>, acá tenés nuevamente tu entrada para <strong>${ticket.events.title}</strong>.</p><div style="margin:26px 0;padding:24px;background:#fff;border:1px solid #e7dcc8;border-radius:16px"><p><strong>${eventDate}</strong></p><p>${ticket.events.venue}</p><img src="${qrImageUrl}" alt="Código QR de entrada" width="280" height="280" style="display:block;width:280px;height:280px;margin:20px auto"><p style="font-family:monospace;font-weight:bold;color:#f4511e">${ticket.qr_code}</p><p><strong>Presentá este QR al ingresar.</strong></p></div><p><a href="${ticketUrl}" style="display:inline-block;background:#f4511e;color:#fff;padding:13px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir entrada digital</a></p><p style="color:#6b6258;font-size:13px">Este código es único y personal. No lo compartas.</p></section></main></body></html>`,
    })
    if (emailError) throw emailError
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error al reenviar entrada:", error)
    return NextResponse.json({ error: "No se pudo reenviar la entrada" }, { status: 500 })
  }
}
