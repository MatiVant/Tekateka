import { createHash } from "node:crypto"
import { createClient } from "@/lib/supabase/admin"
import { ResumePaymentButton } from "@/components/resume-payment-button"

export default async function ResumePaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient()
  const hash = createHash("sha256").update(token).digest("hex")
  const { data: ticket } = await supabase.from("tickets").select("buyer_name, buyer_email, final_price, payment_status, payment_resume_expires_at, events(title, event_date, venue)").eq("payment_resume_token_hash", hash).maybeSingle()
  const expired = !ticket || (ticket.payment_resume_expires_at && new Date(ticket.payment_resume_expires_at) < new Date())
  if (expired) return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-2xl font-bold">Enlace no disponible</h1><p className="mt-3 text-muted-foreground">Este enlace venció o no es válido.</p></main>
  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  const confirmed = ticket.payment_status === "approved" || ticket.payment_status === "confirmed"
  return <main className="mx-auto max-w-xl px-6 py-20"><div className="rounded-xl border bg-card p-8"><p className="text-sm text-muted-foreground">Continuar compra</p><h1 className="mt-2 text-2xl font-bold">{event?.title}</h1><p className="mt-4">Hola {ticket.buyer_name}, podés continuar el pago de tu entrada desde esta página.</p><p className="mt-2 text-sm text-muted-foreground">Importe: {Number(ticket.final_price).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</p>{confirmed ? <p className="mt-6 rounded-md bg-emerald-500/10 p-3 text-emerald-700">Tu entrada ya está confirmada. Revisá tu email.</p> : <ResumePaymentButton token={token} />}</div></main>
}
