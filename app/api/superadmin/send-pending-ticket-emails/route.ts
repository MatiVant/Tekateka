import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth"
import { sendConfirmedTicketEmail } from "@/lib/send-confirmed-ticket-email"

export async function GET() {
  const { authorized } = await requireAuth(["superadmin"])
  if (!authorized) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const supabase = createClient()
  const { data, error } = await supabase.from("ticket_email_deliveries").select("id, buyer_email, event_id, status, error_message, attempts, updated_at, events(title)").eq("status", "failed").order("updated_at", { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: "No se pudieron consultar los fallos" }, { status: 500 })
  return NextResponse.json({ failures: data ?? [] })
}

export async function POST() {
  const { authorized } = await requireAuth(["superadmin"])
  if (!authorized) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const supabase = createClient()
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, purchase_group_id, buyer_email, event_id, events!inner(event_date)")
    .eq("status", "confirmed")
    .eq("payment_status", "approved")
    .gt("events.event_date", new Date().toISOString())
    .order("purchased_at", { ascending: true })
  if (error) return NextResponse.json({ error: "No se pudieron buscar las entradas" }, { status: 500 })

  const groups = new Map<string, string[]>()
  for (const ticket of tickets ?? []) {
    const key = ticket.purchase_group_id || ticket.id
    groups.set(key, [...(groups.get(key) ?? []), ticket.id])
  }

  let sent = 0
  let failed = 0
  const failures: { ticketIds: string[]; reason: string }[] = []
  for (const ticketIds of groups.values()) {
    const result = await sendConfirmedTicketEmail(ticketIds)
    if (result.sent) sent += 1
    else {
      failed += 1
      failures.push({ ticketIds, reason: String(result.reason ?? "unknown") })
    }
  }
  return NextResponse.json({ total: groups.size, sent, failed, failures })
}
