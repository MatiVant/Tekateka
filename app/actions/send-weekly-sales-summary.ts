"use server"

import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character)

export async function sendWeeklySalesSummary() {
  const userData = await getCurrentUser()
  if (!userData?.user.email || !userData.user.email_confirmed_at || userData.profile?.role !== "organizer") {
    return { success: false, message: "Iniciá sesión con una cuenta de organizador y un correo verificado." }
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, message: "El envío de correo no está configurado." }
  }

  const supabase = await createClient()
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title")
    .eq("organizer_id", userData.user.id)

  if (eventsError) {
    return { success: false, message: "No se pudieron consultar tus eventos." }
  }

  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const eventIds = (events ?? []).map((event) => event.id)
  const { data: tickets, error: ticketsError } = eventIds.length
    ? await supabase
        .from("tickets")
        .select("event_id, status, payment_status, payment_receipt_url, charged_amount, final_price")
        .in("event_id", eventIds)
        .gte("purchased_at", startDate.toISOString())
    : { data: [], error: null }

  if (ticketsError) {
    return { success: false, message: "No se pudieron consultar las ventas recientes." }
  }

  const rows = (events ?? []).map((event) => {
    const eventTickets = (tickets ?? []).filter((ticket) => ticket.event_id === event.id)
    const soldTickets = eventTickets.filter((ticket) =>
      ticket.status !== "cancelled" &&
      (ticket.status === "confirmed" || ticket.status === "used" || ticket.payment_status === "approved" || Boolean(ticket.payment_receipt_url)),
    )
    const pendingTickets = eventTickets.filter(
      (ticket) => ticket.status === "pending" && ticket.payment_status !== "approved",
    )
    const gross = soldTickets.reduce(
      (sum, ticket) => sum + Number(ticket.charged_amount ?? ticket.final_price ?? 0),
      0,
    )

    return { title: event.title, sold: soldTickets.length, pending: pendingTickets.length, gross }
  })

  const totalSold = rows.reduce((sum, row) => sum + row.sold, 0)
  const totalPending = rows.reduce((sum, row) => sum + row.pending, 0)
  const totalGross = rows.reduce((sum, row) => sum + row.gross, 0)
  const dateRange = `${startDate.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}–${new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`
  const tableRows = rows.map((row) => `
    <tr>
      <td style="padding:12px;border-top:1px solid #e7dcc8">${escapeHtml(row.title)}</td>
      <td style="padding:12px;border-top:1px solid #e7dcc8;text-align:right">${row.sold}</td>
      <td style="padding:12px;border-top:1px solid #e7dcc8;text-align:right">${formatCurrency(row.gross)}</td>
      <td style="padding:12px;border-top:1px solid #e7dcc8;text-align:right">${row.pending}</td>
    </tr>`).join("")

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailError } = await resend.emails.send({
    from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
    to: userData.user.email,
    subject: `Resumen de ventas de tus eventos (${dateRange})`,
    html: `<!doctype html><html><body style="margin:0;background:#f4eddf;color:#171717;font-family:Arial,sans-serif"><main style="max-width:720px;margin:auto;padding:28px 18px"><header style="padding:12px 0 22px;border-bottom:4px solid #f4511e"><strong style="font-size:28px">TekaTeka</strong><p style="margin:8px 0 0;color:#6b6258">Resumen de actividad · últimos 7 días · ${dateRange}</p></header><section style="margin-top:22px;background:#fffdf7;border:1px solid #e7dcc8;border-radius:16px;padding:24px"><h1 style="font-size:24px">Hola ${escapeHtml(userData.profile?.full_name || "")}</h1><p>Entradas vendidas: <strong>${totalSold}</strong> · Total bruto: <strong>${formatCurrency(totalGross)}</strong> · Pendientes: <strong>${totalPending}</strong></p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:12px;text-align:left">Evento</th><th style="padding:12px;text-align:right">Vendidas</th><th style="padding:12px;text-align:right">Total bruto</th><th style="padding:12px;text-align:right">Pendientes</th></tr></thead><tbody>${tableRows || '<tr><td colspan="4" style="padding:18px;text-align:center">No hay eventos para mostrar.</td></tr>'}</tbody></table></div><p style="margin-top:20px;font-size:12px;color:#6b6258">Este resumen incluye pagos confirmados y comprobantes cargados; excluye entradas canceladas.</p></section></main></body></html>`,
  })

  if (emailError) {
    console.error("[v0] No se pudo enviar el resumen semanal de ventas:", emailError)
    return { success: false, message: "No se pudo enviar el resumen. Intentá de nuevo más tarde." }
  }

  return { success: true, message: `Resumen de los últimos 7 días enviado a ${userData.user.email}.` }
}
