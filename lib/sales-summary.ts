import { Resend } from "resend"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

export type SalesSummaryFrequency = "monthly" | "weekly" | "off"
export type SalesSummaryPeriod = "week" | "month" | "now"

export type PeriodRange = { start: Date; end: Date; label: string }

type SummaryRow = {
  title: string
  status: string | null
  sold: number
  pending: number
  gross: number
  doorSold: number
  doorGross: number
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character] ?? character))

const formatCurrency = (amount: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)
const formatDate = (date: Date) => date.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })

export function getSummaryRange(period: SalesSummaryPeriod, now = new Date()): PeriodRange {
  const end = new Date(now)
  const start = new Date(now)
  if (period === "month" || period === "now") {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(start.getDate() - 7)
  }
  const label = `${formatDate(start)}–${formatDate(end)}`
  return { start, end, label }
}

export function getScheduledSummaryRange(frequency: Exclude<SalesSummaryFrequency, "off">, now = new Date()): PeriodRange {
  if (frequency === "weekly") return getSummaryRange("week", now)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { start, end, label: `${formatDate(start)}–${formatDate(new Date(end.getTime() - 1))}` }
}

function statusLabel(status: string | null) {
  return status === "active" ? "Activo" : "Finalizado"
}

async function buildOrganizerRows(organizerId: string, range: PeriodRange) {
  const supabase = createAdminClient()
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, status")
    .eq("organizer_id", organizerId)
  if (eventsError) throw eventsError

  const eventIds = (events ?? []).map((event) => event.id)
  const [{ data: tickets, error: ticketsError }, { data: doorSales, error: doorSalesError }] = await Promise.all([
    eventIds.length
      ? supabase.from("tickets").select("event_id, status, payment_status, payment_receipt_url, charged_amount, final_price").in("event_id", eventIds).gte("purchased_at", range.start.toISOString()).lt("purchased_at", range.end.toISOString())
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? supabase.from("door_sales").select("event_id, quantity, unit_price").in("event_id", eventIds).gte("created_at", range.start.toISOString()).lt("created_at", range.end.toISOString())
      : Promise.resolve({ data: [], error: null }),
  ])
  if (ticketsError || doorSalesError) throw ticketsError || doorSalesError

  return (events ?? []).map((event): SummaryRow => {
    const eventTickets = (tickets ?? []).filter((ticket) => ticket.event_id === event.id)
    const soldTickets = eventTickets.filter((ticket) => ticket.status !== "cancelled" && (ticket.status === "confirmed" || ticket.status === "used" || ticket.payment_status === "approved" || Boolean(ticket.payment_receipt_url)))
    const pendingTickets = eventTickets.filter((ticket) => ticket.status === "pending" && ticket.payment_status !== "approved")
    const eventDoorSales = (doorSales ?? []).filter((sale) => sale.event_id === event.id)
    return {
      title: event.title,
      status: event.status,
      sold: soldTickets.length,
      pending: pendingTickets.length,
      gross: soldTickets.reduce((sum, ticket) => sum + Number(ticket.charged_amount ?? ticket.final_price ?? 0), 0),
      doorSold: eventDoorSales.reduce((sum, sale) => sum + Number(sale.quantity ?? 0), 0),
      doorGross: eventDoorSales.reduce((sum, sale) => sum + Number(sale.quantity ?? 0) * Number(sale.unit_price ?? 0), 0),
    }
  })
}

export async function sendOrganizerSalesSummary(organizer: { id: string; email: string; full_name?: string | null }, period: SalesSummaryPeriod, idempotencyKey?: string, rangeOverride?: PeriodRange) {
  if (!process.env.RESEND_API_KEY) throw new Error("El envío de correo no está configurado.")
  const range = rangeOverride ?? getSummaryRange(period)
  const rows = await buildOrganizerRows(organizer.id, range)
  const totalSold = rows.reduce((sum, row) => sum + row.sold + row.doorSold, 0)
  const totalGross = rows.reduce((sum, row) => sum + row.gross + row.doorGross, 0)
  const totalPending = rows.reduce((sum, row) => sum + row.pending, 0)
  const tableRows = rows.map((row) => `<tr><td style="padding:10px;border-top:1px solid #e7dcc8">${escapeHtml(row.title)}</td><td style="padding:10px;border-top:1px solid #e7dcc8">${statusLabel(row.status)}</td><td style="padding:10px;border-top:1px solid #e7dcc8;text-align:right">${row.sold + row.doorSold}</td><td style="padding:10px;border-top:1px solid #e7dcc8;text-align:right">${formatCurrency(row.gross + row.doorGross)}</td><td style="padding:10px;border-top:1px solid #e7dcc8;text-align:right">${row.pending}</td></tr>`).join("")
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
    to: organizer.email,
    subject: `Resumen de ventas (${range.label})`,
    html: `<main style="font-family:Arial,sans-serif;max-width:760px;margin:auto;padding:24px"><h1>Resumen de ventas</h1><p>Hola ${escapeHtml(organizer.full_name || "")},</p><p>Período: <strong>${range.label}</strong></p><p>Entradas vendidas: <strong>${totalSold}</strong> · Total recaudado: <strong>${formatCurrency(totalGross)}</strong> · Pendientes: <strong>${totalPending}</strong></p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:10px">Evento</th><th style="text-align:left;padding:10px">Estado</th><th style="text-align:right;padding:10px">Vendidas</th><th style="text-align:right;padding:10px">Total</th><th style="text-align:right;padding:10px">Pendientes</th></tr></thead><tbody>${tableRows || '<tr><td colspan="5" style="padding:18px;text-align:center">No hay eventos para mostrar.</td></tr>'}</tbody></table><p style="font-size:12px;color:#6b6258">El total incluye ventas online y ventas registradas en puerta. Se excluyen entradas canceladas.</p></main>`,
  }, idempotencyKey ? { idempotencyKey } : undefined)
  if (error) throw error
  return { totalSold, totalGross, totalPending, range }
}

export async function getOrganizerRecipients() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from("profiles").select("id, email, full_name").eq("role", "organizer").not("email", "is", null)
  if (error) throw error
  return (data ?? []).filter((organizer): organizer is typeof organizer & { email: string } => Boolean(organizer.email))
}
