import { Resend } from "resend"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character] ?? character))

const formatCurrency = (amount: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) return Response.json({ error: "Email is not configured" }, { status: 503 })

  const supabase = createAdminClient()
  const { data: organizers, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "organizer")
    .not("email", "is", null)

  if (error) return Response.json({ error: "Could not load organizers" }, { status: 500 })

  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0

  for (const organizer of organizers ?? []) {
    const { data: events } = await supabase.from("events").select("id, title").eq("organizer_id", organizer.id)
    const eventIds = (events ?? []).map((event) => event.id)
    const { data: tickets } = eventIds.length
      ? await supabase.from("tickets").select("event_id, status, payment_status, payment_receipt_url, charged_amount, final_price").in("event_id", eventIds).gte("purchased_at", startDate.toISOString())
      : { data: [] }

    const rows = (events ?? []).map((event) => {
      const eventTickets = (tickets ?? []).filter((ticket) => ticket.event_id === event.id)
      const sold = eventTickets.filter((ticket) => ticket.status !== "cancelled" && (ticket.status === "confirmed" || ticket.status === "used" || ticket.payment_status === "approved"))
      const pending = eventTickets.filter((ticket) => ticket.status === "pending" && ticket.payment_status !== "approved")
      const gross = sold.reduce((sum, ticket) => sum + Number(ticket.charged_amount ?? ticket.final_price ?? 0), 0)
      return { title: event.title, sold: sold.length, pending: pending.length, gross }
    })
    const totalSold = rows.reduce((sum, row) => sum + row.sold, 0)
    const totalPending = rows.reduce((sum, row) => sum + row.pending, 0)
    const totalGross = rows.reduce((sum, row) => sum + row.gross, 0)
    const dateRange = `${startDate.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}–${new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`
    const tableRows = rows.map((row) => `<tr><td style="padding:10px;border-top:1px solid #e7dcc8">${escapeHtml(row.title)}</td><td style="padding:10px;border-top:1px solid #e7dcc8;text-align:right">${row.sold}</td><td style="padding:10px;border-top:1px solid #e7dcc8;text-align:right">${formatCurrency(row.gross)}</td><td style="padding:10px;border-top:1px solid #e7dcc8;text-align:right">${row.pending}</td></tr>`).join("")

    const { error: sendError } = await resend.emails.send({
      from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
      to: organizer.email,
      subject: `Resumen semanal de ventas (${dateRange})`,
      html: `<main style="font-family:Arial,sans-serif;max-width:720px;margin:auto;padding:24px"><h1>Resumen semanal de ventas</h1><p>Hola ${escapeHtml(organizer.full_name || "")},</p><p>Entradas vendidas: <strong>${totalSold}</strong> · Total bruto: <strong>${formatCurrency(totalGross)}</strong> · Pendientes: <strong>${totalPending}</strong></p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Evento</th><th>Vendidas</th><th>Total bruto</th><th>Pendientes</th></tr></thead><tbody>${tableRows || '<tr><td colspan="4">No hay ventas recientes.</td></tr>'}</tbody></table><p style="font-size:12px;color:#6b6258">Período: ${dateRange}. Se excluyen entradas canceladas.</p></main>`,
    }, { idempotencyKey: `weekly-sales-summary/${organizer.id}/${startDate.toISOString().slice(0, 10)}` })
    if (!sendError) sent += 1
  }

  return Response.json({ success: true, sent })
}

export { GET as POST }
