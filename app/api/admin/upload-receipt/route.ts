import { uploadPublicFile } from "@/lib/supabase/storage-upload"
import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const formData = await request.formData()
  const ticketId = String(formData.get("ticketId") || "")
  const file = formData.get("file")
  if (!ticketId || !(file instanceof File)) return NextResponse.json({ error: "Falta el comprobante" }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "El archivo no puede superar 5 MB" }, { status: 400 })
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") return NextResponse.json({ error: "Solo se aceptan imágenes o PDF" }, { status: 400 })

  const supabase = createAdminClient()
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, event_id, purchase_group_id, payment_id, events(organizer_id)")
    .eq("id", ticketId)
    .maybeSingle()
  const event = Array.isArray(ticket?.events) ? ticket.events[0] : ticket?.events
  if (!ticket || event?.organizer_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  let relatedTicketsQuery = supabase.from("tickets").select("id, status, payment_status").eq("event_id", ticket.event_id)
  if (ticket.purchase_group_id) {
    relatedTicketsQuery = relatedTicketsQuery.eq("purchase_group_id", ticket.purchase_group_id)
  } else if (ticket.payment_id) {
    relatedTicketsQuery = relatedTicketsQuery.eq("payment_id", ticket.payment_id)
  } else {
    relatedTicketsQuery = relatedTicketsQuery.eq("id", ticket.id)
  }
  const { data: relatedTickets, error: relatedTicketsError } = await relatedTicketsQuery
  if (relatedTicketsError || !relatedTickets?.length) {
    return NextResponse.json({ error: "No se pudieron identificar las entradas de la compra" }, { status: 500 })
  }

  let url: string
  try {
    url = await uploadPublicFile("payment-receipts", `receipts/${ticketId}-${Date.now()}-${file.name}`, file)
  } catch (error) {
    console.error("Admin receipt upload error:", error)
    return NextResponse.json({ error: "No se pudo subir el comprobante" }, { status: 503 })
  }
  const { error } = await supabase
    .from("tickets")
    .update({ payment_receipt_url: url })
    .in("id", relatedTickets.map((relatedTicket) => relatedTicket.id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const submittedTicketIds = relatedTickets
    .filter((relatedTicket) => relatedTicket.payment_status !== "approved" && relatedTicket.status !== "confirmed")
    .map((relatedTicket) => relatedTicket.id)
  if (submittedTicketIds.length) {
    const { error: statusError } = await supabase
      .from("tickets")
      .update({ payment_status: "submitted" })
      .in("id", submittedTicketIds)
    if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
