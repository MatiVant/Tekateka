import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { EventCard } from "@/components/event-card"
import { CalendarDays, Ticket } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Eventos disponibles | TekaTeka",
  description: "Encontrá eventos con entradas disponibles y comprá la tuya en TekaTeka.",
}

export default async function EventsPage() {
  const supabase = await createClient()
  const now = new Date()

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("status", "active")
    .gte("event_date", now.toISOString())
    .order("event_date", { ascending: true })

  const eventIds = (events ?? []).map((event) => event.id)
  const { data: confirmedTickets } = eventIds.length > 0
    ? await supabase.from("tickets").select("event_id").in("event_id", eventIds).eq("status", "confirmed")
    : { data: [] }

  const confirmedByEvent = (confirmedTickets ?? []).reduce<Record<string, number>>((counts, ticket) => {
    counts[ticket.event_id] = (counts[ticket.event_id] ?? 0) + 1
    return counts
  }, {})

  const availableEvents = (events ?? []).filter((event) => {
    const startsAt = new Date(event.event_date).getTime()
    const salesStart = event.sales_start_at ? new Date(event.sales_start_at).getTime() : null
    const salesEnd = event.sales_end_at ? new Date(event.sales_end_at).getTime() : null
    const remaining = Number(event.total_tickets ?? 0) - (confirmedByEvent[event.id] ?? 0)

    return startsAt > now.getTime()
      && (salesStart === null || salesStart <= now.getTime())
      && (salesEnd === null || salesEnd > now.getTime())
      && remaining > 0
  }).map((event) => ({
    ...event,
    confirmed_count: confirmedByEvent[event.id] ?? 0,
  }))

  return (
    <main className="min-h-screen">
      <section className="border-b border-[#e7dcc8] bg-[#f4eddf]">
        <div className="container mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-4 py-2 text-sm font-semibold text-primary">
              <CalendarDays className="h-4 w-4" />
              Agenda abierta
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-[-0.05em] text-balance sm:text-5xl md:text-6xl">
              Encontrá tu próximo encuentro.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Todos los eventos con entradas disponibles, ordenados por fecha. Podés comprar hasta el horario de inicio de cada evento.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground/75">
              <Ticket className="h-4 w-4 text-primary" />
              {availableEvents.length} {availableEvents.length === 1 ? "evento disponible" : "eventos disponibles"}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {availableEvents.length > 0 ? (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {availableEvents.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        ) : (
          <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold">Por ahora no hay entradas disponibles</h2>
            <p className="mt-2 text-muted-foreground">Volvé pronto para descubrir los próximos eventos.</p>
          </div>
        )}
      </section>
    </main>
  )
}
