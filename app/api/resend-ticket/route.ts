import { createClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { requireAuth } from "@/lib/auth"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const ticketIds = Array.isArray(body.ticketIds) ? [...new Set(body.ticketIds.filter(Boolean))] : body.ticketId ? [body.ticketId] : []
    if (ticketIds.length === 0 || ticketIds.some((id: unknown) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) return NextResponse.json({ error: "Seleccioná entradas válidas" }, { status: 400 })
    const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])
    if (!authorized || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    if (!resend) return NextResponse.json({ error: "El servicio de email no está configurado" }, { status: 503 })

    const supabase = createClient()
    const { data: tickets, error } = await supabase.from("tickets").select("*, events(id, organizer_id, title, event_date, venue)").in("id", ticketIds)
    if (error || !tickets?.length || tickets.length !== ticketIds.length) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 })
    if (profile?.role !== "superadmin" && tickets.some((item: { events?: { organizer_id?: string | null } | null }) => item.events?.organizer_id !== user.id)) return NextResponse.json({ error: "No tenés permiso para reenviar estas entradas" }, { status: 403 })
    const firstTicket = tickets[0]
    const sameBuyer = tickets.every((item) => item.buyer_email === firstTicket.buyer_email && item.events?.id === firstTicket.events?.id)
    if (!sameBuyer) return NextResponse.json({ error: "Las entradas deben pertenecer al mismo comprador y evento" }, { status: 400 })
    if (tickets.some((item) => item.status !== "confirmed" || item.payment_status !== "approved")) return NextResponse.json({ error: "Solo se pueden reenviar entradas confirmadas" }, { status: 400 })
    const ticket = firstTicket

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tktk.buholabs.com.ar"
    const eventDate = new Date(ticket.events.event_date).toLocaleString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })
    const ticketCards = tickets.map((item) => {
      const itemUrl = `${siteUrl.replace(/\/$/, "")}/ticket/${encodeURIComponent(item.qr_code)}`
      const itemQrUrl = `${siteUrl.replace(/\/$/, "")}/api/generate-qr?code=${encodeURIComponent(itemUrl)}`
      return `<div style="margin:26px 0;padding:24px;background:#fff;border:1px solid #e7dcc8;border-radius:16px"><p><strong>${eventDate}</strong></p><p>${item.events.venue}</p><img src="${itemQrUrl}" alt="Código QR de entrada" width="280" height="280" style="display:block;width:280px;height:280px;margin:20px auto"><p style="font-family:monospace;font-weight:bold;color:#f4511e">${item.qr_code}</p><p><strong>Presentá este QR al ingresar.</strong></p><p><a href="${itemUrl}">Abrir entrada digital</a></p></div>`
    }).join("")

    const { error: emailError } = await resend.emails.send({
      from: "TekaTeka <notificaciones@tktk.buholabs.com.ar>",
      to: ticket.buyer_email,
      subject: `Tu entrada está confirmada: ${ticket.events.title}`,
      html: `<!doctype html><html><body style="margin:0;background:#f4eddf;color:#171717;font-family:Arial,sans-serif"><main style="max-width:620px;margin:auto;padding:28px 18px"><header style="padding:12px 0 22px;border-bottom:4px solid #f4511e"><img src="${siteUrl.replace(/\/$/, "")}/tekateka-logo.png" alt="TekaTeka — Tus eventos. Tus entradas." width="220" style="display:block;width:220px;height:auto"></header><section style="background:#fffdf7;border:1px solid #e7dcc8;border-radius:0 0 18px 18px;padding:30px;text-align:center"><p style="color:#f4511e;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Tu entrada digital</p><h1 style="font-size:30px;letter-spacing:-1px">Tu entrada está confirmada</h1><p>Hola <strong>${ticket.buyer_name}</strong>, acá tenés nuevamente tu entrada para <strong>${ticket.events.title}</strong>.</p>${ticketCards}<p>Este email contiene ${tickets.length} entradas confirmadas.</p><p style="color:#6b6258;font-size:13px">Este código es único y personal. No lo compartas.</p><hr style="border:0;border-top:1px solid #e7dcc8;margin:24px 0 14px" /><p style="color:#6b6258;font-size:12px">Este correo es automático y no recibe respuestas. Si tenés dudas, escribinos a <a href="mailto:consultas@tekateka.com.ar">consultas@tekateka.com.ar</a>.</p></section></main></body></html>`,
    })
    if (emailError) throw emailError
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error al reenviar entrada:", error)
    return NextResponse.json({ error: "No se pudo reenviar la entrada" }, { status: 500 })
  }
}
