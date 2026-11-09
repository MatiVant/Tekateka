import { Resend } from "resend"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

export type SalesSummaryFrequency = "monthly" | "weekly" | "biweekly" | "off"
export type SalesSummaryPeriod = "week" | "fortnight" | "month" | "now"

export type PeriodRange = { start: Date; end: Date; label: string }

type SummaryRow = {
  title: string
  eventDate: string | null
  venue: string | null
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
const formatEventDate = (value: string | null) => value ? formatDate(new Date(value)) : "Sin fecha"

export function getSummaryRange(period: SalesSummaryPeriod, now = new Date()): PeriodRange {
  const end = new Date(now)
  const start = new Date(now)
  if (period === "month" || period === "now") {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  } else if (period === "fortnight") {
    start.setDate(start.getDate() - 15)
  } else {
    start.setDate(start.getDate() - 7)
  }
  const label = `${formatDate(start)}–${formatDate(end)}`
  return { start, end, label }
}

export function getScheduledSummaryRange(frequency: Exclude<SalesSummaryFrequency, "off">, now = new Date()): PeriodRange {
  if (frequency === "weekly") return getSummaryRange("week", now)
  if (frequency === "biweekly") {
    const isFirstHalf = now.getDate() === 1
    const end = new Date(now.getFullYear(), now.getMonth(), isFirstHalf ? 1 : 16)
    const start = isFirstHalf
      ? new Date(now.getFullYear(), now.getMonth() - 1, 16)
      : new Date(now.getFullYear(), now.getMonth(), 1)
    return { start, end, label: `${formatDate(start)}–${formatDate(new Date(end.getTime() - 1))}` }
  }
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
    .select("id, title, status, event_date, venue")
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
      eventDate: event.event_date,
      venue: event.venue,
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
  const tableRows = rows.map((row) => `<tr><td style="padding:14px 10px;border-top:1px solid #e7dcc8"><strong>${escapeHtml(row.title)}</strong><br><span style="font-size:12px;color:#6b6258">${formatEventDate(row.eventDate)} · ${escapeHtml(row.venue || "Sin espacio")}</span></td><td style="padding:14px 10px;border-top:1px solid #e7dcc8">${statusLabel(row.status)}</td><td style="padding:14px 10px;border-top:1px solid #e7dcc8;text-align:right"><strong>${row.sold + row.doorSold}</strong><br><span style="font-size:12px;color:#6b6258">online ${row.sold} · puerta ${row.doorSold}</span></td><td style="padding:14px 10px;border-top:1px solid #e7dcc8;text-align:right">${formatCurrency(row.gross + row.doorGross)}</td><td style="padding:14px 10px;border-top:1px solid #e7dcc8;text-align:right">${row.pending}</td></tr>`).join("")
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
    to: organizer.email,
    subject: `Resumen de ventas (${range.label})`,
    html: `<main style="font-family:Arial,sans-serif;max-width:820px;margin:auto;padding:24px;background:#f4eddf;color:#171717"><section style="background:#fffdf7;border:1px solid #e7dcc8;border-radius:18px;padding:26px"><div style="border-bottom:4px solid #f4511e;padding-bottom:18px"><strong style="font-size:28px">TekaTeka</strong><p style="margin:8px 0 0;color:#6b6258">Informe de actividad · ${range.label}</p></div><h1 style="font-size:25px;margin:24px 0 8px">Resumen de ventas</h1><p style="margin-top:0">Hola ${escapeHtml(organizer.full_name || "")},</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin:22px 0"><div style="background:#f4eddf;border-radius:12px;padding:14px 16px;min-width:150px"><div style="font-size:12px;color:#6b6258">Entradas vendidas</div><strong style="font-size:22px">${totalSold}</strong></div><div style="background:#f4eddf;border-radius:12px;padding:14px 16px;min-width:150px"><div style="font-size:12px;color:#6b6258">Recaudación bruta</div><strong style="font-size:22px">${formatCurrency(totalGross)}</strong></div><div style="background:#f4eddf;border-radius:12px;padding:14px 16px;min-width:150px"><div style="font-size:12px;color:#6b6258">Pendientes</div><strong style="font-size:22px">${totalPending}</strong></div></div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:680px"><thead><tr><th style="text-align:left;padding:10px">Evento</th><th style="text-align:left;padding:10px">Estado</th><th style="text-align:right;padding:10px">Entradas</th><th style="text-align:right;padding:10px">Recaudación</th><th style="text-align:right;padding:10px">Pendientes</th></tr></thead><tbody>${tableRows || '<tr><td colspan="5" style="padding:18px;text-align:center">No hay eventos para mostrar.</td></tr>'}</tbody></table></div><p style="font-size:12px;color:#6b6258;margin-top:22px">El total incluye ventas online y ventas registradas en puerta. Se excluyen entradas canceladas.</p></section></main>`, 
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
