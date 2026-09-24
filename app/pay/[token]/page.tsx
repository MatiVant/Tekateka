import { createHash } from "node:crypto"
import { createClient } from "@/lib/supabase/admin"
import { ResumePaymentButton } from "@/components/resume-payment-button"
import { CancelPaymentButton } from "@/components/cancel-payment-button"
import { ResumeReceiptUpload } from "@/components/resume-receipt-upload"

export default async function ResumePaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient()
  const hash = createHash("sha256").update(token).digest("hex")
  const { data: tickets } = await supabase.from("tickets").select("buyer_name, buyer_email, final_price, payment_status, payment_method, payment_resume_expires_at, events(title, event_date, venue)").eq("payment_resume_token_hash", hash)
  const firstTicket = tickets?.[0]
  const expired = !firstTicket || tickets.some((ticket) => ticket.payment_resume_expires_at && new Date(ticket.payment_resume_expires_at) < new Date())
  if (expired) return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-2xl font-bold">Enlace no disponible</h1><p className="mt-3 text-muted-foreground">Este enlace venció o no es válido.</p></main>
  const event = Array.isArray(firstTicket.events) ? firstTicket.events[0] : firstTicket.events
  const quantity = tickets.length
  const totalAmount = tickets.reduce((total, ticket) => total + Number(ticket.final_price || 0), 0)
  const confirmed = tickets.every((ticket) => ticket.payment_status === "approved" || ticket.payment_status === "confirmed")
  const isTransfer = tickets.every((ticket) => ["transfer", "transferencia"].includes(String(ticket.payment_method).toLowerCase()))
  return <main className="mx-auto max-w-xl px-6 py-20"><div className="rounded-xl border bg-card p-8"><p className="text-sm text-muted-foreground">Continuar compra</p><h1 className="mt-2 text-2xl font-bold">{event?.title}</h1><p className="mt-4">Hola {firstTicket.buyer_name}, podés continuar el pago de tus {quantity === 1 ? "entrada" : `${quantity} entradas`} desde esta página.</p><p className="mt-2 text-sm text-muted-foreground">Si necesitás ayuda, escribinos a <a className="font-medium text-primary underline" href="mailto:consultas@tekateka.com.ar">consultas@tekateka.com.ar</a>.</p><p className="mt-2 text-sm text-muted-foreground">Total: {totalAmount.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</p>{confirmed ? <p className="mt-6 rounded-md bg-emerald-500/10 p-3 text-emerald-700">Tus entradas ya están confirmadas. Revisá tu email.</p> : isTransfer ? <><ResumeReceiptUpload token={token} /><CancelPaymentButton token={token} /></> : <><ResumePaymentButton token={token} /><CancelPaymentButton token={token} /></>}</div></main>
}
