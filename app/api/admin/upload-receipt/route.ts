import { put } from "@vercel/blob"
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
  const { data: ticket } = await supabase.from("tickets").select("id, event_id, status, payment_status, payment_receipt_url, events(organizer_id)").eq("id", ticketId).maybeSingle()
  const event = Array.isArray(ticket?.events) ? ticket.events[0] : ticket?.events
  if (!ticket || event?.organizer_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const blob = await put(`receipts/${ticketId}-${Date.now()}-${file.name}`, file, { access: "public", addRandomSuffix: true })
  const nextPaymentStatus = ticket.payment_status === "approved" || ticket.status === "confirmed" ? ticket.payment_status : "submitted"
  const { error } = await supabase.from("tickets").update({ payment_receipt_url: blob.url, payment_status: nextPaymentStatus }).eq("id", ticketId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
