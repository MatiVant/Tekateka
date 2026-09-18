import { createClient } from "@/lib/supabase/server"
import { EventCard } from "@/components/event-card"
import { Sparkles, Calendar, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function HomePage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .in("status", ["active", "inactive", "sold_out"])
    .order("event_date", { ascending: true })

  const { data: confirmedTickets } = await supabase
    .from("tickets")
    .select("event_id")
    .eq("status", "confirmed")
  const confirmedByEvent = (confirmedTickets || []).reduce<Record<string, number>>((counts, ticket) => {
    counts[ticket.event_id] = (counts[ticket.event_id] || 0) + 1
    return counts
  }, {})
  const eventsWithAvailability = (events || []).map((event) => ({
    ...event,
    confirmed_count: confirmedByEvent[event.id] || 0,
  }))
  const featuredEvents = eventsWithAvailability.slice(0, 3)
  const regularEvents = eventsWithAvailability.slice(3)

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden min-h-[600px] flex items-center" style={{ backgroundImage: 'url(/tekateka-home.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl teka-editorial">
            <div className="mb-8">
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.24em] text-primary">Más cultura. Más encuentros.</p>
              <h1 className="max-w-2xl text-6xl font-black leading-[0.9] tracking-[-0.07em] text-balance md:text-8xl">
                Descubrí qué está pasando cerca tuyo.
              </h1>
              <p className="mt-7 max-w-xl text-xl leading-relaxed text-muted-foreground md:text-2xl">Eventos, música, teatro, fiestas y encuentros independientes.</p>
              <Button asChild size="lg" className="mt-8 rounded-full px-7 font-bold"><Link href="#eventos">Ver qué hay hoy <span aria-hidden="true">→</span></Link></Button>
            </div>
          </div>
        </div>
      </section>

      <main id="eventos" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {featuredEvents.length > 0 && (
          <section className="mb-20">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black tracking-[-0.04em] md:text-5xl">Qué está pasando <span className="text-primary">↓</span></h2>
                <p className="mt-3 text-muted-foreground">Elegí tu próximo encuentro.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {featuredEvents.map((event, index) => (
                <div key={event.id} className={index === 0 ? "lg:col-span-2 lg:row-span-2" : ""}>
                  <EventCard event={event} featured={index === 0} />
                </div>
              ))}
            </div>
          </section>
        )}

        {regularEvents.length > 0 && (
          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-8">Todos los eventos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {regularEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}

        {(!events || events.length === 0) && (
          <div className="text-center py-32 px-4">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-3">No hay eventos disponibles</h2>
              <p className="text-lg text-muted-foreground">Vuelve pronto para descubrir los próximos espectáculos</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
