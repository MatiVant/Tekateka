import { notFound } from "next/navigation"
import Image from "next/image"
import crypto from "node:crypto"
import { createClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

type ShareTicket = {
  id: string
  buyer_name: string
  buyer_email: string
  buyer_phone: string | null
  status: string
  payment_status: string | null
  payment_method: string | null
  final_price: number | string | null
  charged_amount: number | string | null
  payment_receipt_url: string | null
  purchased_at: string
  ticket_tiers: { name: string }[]
  ticket_promotions: unknown[] | null
}

export default async function ArtistSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient()
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const { data: link } = await supabase.from("artist_share_links").select("id, event_id, permissions, expires_at, revoked_at").eq("token_hash", tokenHash).single()
  if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at) < new Date())) notFound()
  await supabase.from("artist_share_links").update({ last_accessed_at: new Date().toISOString() }).eq("id", link.id)
  const { data: event } = await supabase.from("events").select("title, event_date, venue").eq("id", link.event_id).single()
  const { data: tickets } = await supabase.from("tickets").select("id, buyer_name, buyer_email, buyer_phone, status, payment_status, payment_method, final_price, charged_amount, payment_receipt_url, purchased_at, ticket_tiers(name), ticket_promotions(promotion_codes(code, promotion_type, discount_value))").eq("event_id", link.event_id).order("purchased_at", { ascending: false })
  if (!event) notFound()
  const rows = (tickets ?? []) as ShareTicket[]
  const confirmed = rows.filter((ticket) => ticket.status === "confirmed" || ticket.status === "used" || ticket.payment_status === "approved")
  const pending = rows.filter((ticket) => ticket.status === "pending" && ticket.payment_status !== "approved")
  const free = confirmed.filter((ticket) => ticket.payment_method === "free" || Number(ticket.final_price) === 0)
  const discounted = confirmed.filter((ticket) => Number(ticket.final_price) > 0 && Boolean(ticket.ticket_promotions?.length))
  const fullPrice = confirmed.filter((ticket) => Number(ticket.final_price) > 0 && !ticket.ticket_promotions?.length)
  const confirmedTotal = confirmed.reduce((sum, ticket) => sum + Number(ticket.charged_amount ?? ticket.final_price ?? 0), 0)
  const canSeeBuyers = Boolean(link.permissions?.buyers)
  // The generated Supabase relation shape is intentionally rendered in this compact share view.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <main className="min-h-screen bg-background p-4 sm:p-6"><div className="mx-auto max-w-5xl space-y-6"><header className="flex items-center justify-between border-b border-foreground/10 pb-4"><Image src="/tekateka-logo.png" alt="TekaTeka — Tus eventos. Tus entradas." width={220} height={74} className="h-12 w-auto object-contain" priority /><Image src="/tekateka-mark.png" alt="" width={44} height={44} className="h-10 w-10 object-contain" aria-hidden="true" /></header><div><p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Informe compartido</p><h1 className="text-3xl font-bold">{event.title}</h1><p className="text-muted-foreground">{event.venue || ""}</p></div><div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">{[["Entradas confirmadas", confirmed.length], ["Gratis", free.length], ["Con descuento", discounted.length], ["Precio completo", fullPrice.length], ["Total confirmado", `$${confirmedTotal.toLocaleString("es-AR")}`]].map(([label, value]) => <Card key={String(label)}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader><CardContent><span className="text-3xl font-bold">{value}</span></CardContent></Card>)}</div>{pending.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"><strong>{pending.length} {pending.length === 1 ? "entrada pendiente" : "entradas pendientes"}</strong> de comprobante o confirmación. No se incluyen en el detalle ni en los totales confirmados.</div>}<Card><CardHeader><CardTitle>Entradas confirmadas</CardTitle><p className="text-sm text-muted-foreground">Este informe muestra únicamente las entradas listas para el evento.</p></CardHeader><CardContent>{canSeeBuyers ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Comprador</th><th className="p-2">Email</th><th className="p-2">Teléfono</th><th className="p-2">Estado</th><th className="p-2">Tipo</th><th className="p-2">Código</th><th className="p-2">Importe</th></tr></thead><tbody>{confirmed.map((ticket, index) => <tr className="border-b" key={`${ticket.buyer_email}-${index}`}><td className="p-2">{ticket.buyer_name}</td><td className="p-2">{ticket.buyer_email}</td><td className="p-2">{ticket.buyer_phone || "No informado"}</td><td className="p-2">{ticket.status === "confirmed" || ticket.payment_status === "approved" ? "Confirmada" : "Pendiente"}</td><td className="p-2">{ticket.payment_method === "free" || Number(ticket.final_price) === 0 ? "Gratis" : ticket.payment_method === "transfer" ? "Transferencia" : "Venta"}</td><td className="p-2">{ticket.ticket_promotions?.map((promotion: any) => promotion.promotion_codes?.code).filter(Boolean).join(", ") || "—"}</td><td className="p-2">{Number(ticket.final_price) === 0 ? "Gratis" : ticket.final_price != null ? Number(ticket.final_price).toLocaleString("es-AR", { style: "currency", currency: "ARS" }) : "—"}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">El productor no habilitó el detalle de compradores.</p>}</CardContent></Card></div></main>
}
