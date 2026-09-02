import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/admin"
import { TicketDetails } from "@/components/verify/ticket-details"

export default async function PublicTicketPage({ params }: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await params
  const supabase = createClient()
  const { data: ticket } = await supabase
    .from("tickets")
    .select("buyer_name, buyer_email, qr_code, status, purchased_at, events(title, event_date, venue)")
    .eq("qr_code", decodeURIComponent(qrCode))
    .maybeSingle()

  if (!ticket) notFound()

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-center text-2xl font-bold">Entrada digital</h1>
        <TicketDetails ticket={ticket as Parameters<typeof TicketDetails>[0]["ticket"]} />
      </div>
    </main>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await params
  const supabase = createClient()
  const { data: ticket } = await supabase.from("tickets").select("events(title)").eq("qr_code", decodeURIComponent(qrCode)).maybeSingle()
  const event = Array.isArray(ticket?.events) ? ticket.events[0] : ticket?.events
  return { title: event?.title ? `Entrada - ${event.title}` : "Entrada digital" }
}
