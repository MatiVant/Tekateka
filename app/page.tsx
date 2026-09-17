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
      <section className="relative overflow-hidden min-h-[600px] flex items-center" style={{ backgroundImage: 'url(/hero-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <div className="mb-8">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 text-balance leading-[1.1] text-foreground">
                Descubre eventos
              </h1>
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Eventos cerca tuyo</p>
              <p className="text-xl md:text-2xl text-muted-foreground text-pretty max-w-2xl leading-relaxed">
                Compra entradas de forma segura e instantánea para los mejores eventos
              </p>
              <Button asChild size="lg" className="mt-8"><Link href="#eventos">Explorar eventos</Link></Button>
            </div>
          </div>
        </div>
      </section>

      <main id="eventos" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {featuredEvents.length > 0 && (
          <section className="mb-20">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-2">Próximos eventos</h2>
                <p className="text-muted-foreground">No te pierdas estos espectáculos</p>
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
