import { createHash } from "node:crypto"
import { uploadPublicFile } from "@/lib/supabase/storage-upload"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const formData = await request.formData()
  const token = String(formData.get("token") || "")
  const file = formData.get("file")
  const notes = String(formData.get("notes") || "").trim()
  if (!token || !(file instanceof File)) return NextResponse.json({ error: "Falta el comprobante" }, { status: 400 })
  const supabase = createClient()
  const hash = createHash("sha256").update(token).digest("hex")
  const { data: tickets } = await supabase.from("tickets").select("id, payment_resume_expires_at, payment_method").eq("payment_resume_token_hash", hash)
  if (!tickets?.length || tickets.some((ticket) => (ticket.payment_resume_expires_at && new Date(ticket.payment_resume_expires_at) < new Date()) || !["transfer", "transferencia"].includes(String(ticket.payment_method).toLowerCase()))) return NextResponse.json({ error: "Enlace no válido o vencido" }, { status: 403 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "El archivo no puede superar 5 MB" }, { status: 400 })
  let url: string
  try {
    url = await uploadPublicFile("payment-receipts", `receipts/${tickets[0].id}-${Date.now()}-${file.name}`, file)
  } catch (error) {
    console.error("Receipt upload error:", error)
    return NextResponse.json({ error: "STORAGE_UPLOAD_UNAVAILABLE" }, { status: 503 })
  }
  const { error } = await supabase.from("tickets").update({ payment_receipt_url: url, payment_notes: notes || null, payment_status: "submitted" }).eq("payment_resume_token_hash", hash).in("payment_method", ["transfer", "transferencia"])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
