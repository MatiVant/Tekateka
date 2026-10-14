import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { EventCard } from "@/components/event-card"
import { Sparkles, Calendar, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function HomePage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_public", true)
    .gte("event_date", new Date().toISOString())
    .in("status", ["active", "inactive", "sold_out"])
    .order("event_date", { ascending: true })

  const eventIds = (events || []).map((event) => event.id)
  const { data: confirmedTickets } = eventIds.length
    ? await supabase
        .from("tickets")
        .select("event_id")
        .in("status", ["pending", "confirmed", "used"])
        .in("event_id", eventIds)
    : { data: [] }
  const { data: doorSales } = eventIds.length
    ? await createAdminClient().from("door_sales").select("event_id, quantity").in("event_id", eventIds)
    : { data: [] }
  const doorSalesByEvent = (doorSales || []).reduce<Record<string, number>>((counts, sale) => {
    counts[sale.event_id] = (counts[sale.event_id] || 0) + Number(sale.quantity || 0)
    return counts
  }, {})
  const { data: ticketTiers } = eventIds.length
    ? await supabase
        .from("ticket_tiers")
        .select("event_id, base_price")
        .in("event_id", eventIds)
        .order("base_price", { ascending: true })
    : { data: [] }
  const minPriceByEvent = (ticketTiers || []).reduce<Record<string, number>>((prices, tier) => {
    if (prices[tier.event_id] === undefined) prices[tier.event_id] = tier.base_price
    return prices
  }, {})
  const confirmedByEvent = (confirmedTickets || []).reduce<Record<string, number>>((counts, ticket) => {
    counts[ticket.event_id] = (counts[ticket.event_id] || 0) + 1
    return counts
  }, {})
  const eventsWithAvailability = (events || []).map((event) => ({
    ...event,
    confirmed_count: (confirmedByEvent[event.id] || 0) + (doorSalesByEvent[event.id] || 0),
    min_price: minPriceByEvent[event.id] ?? null,
  }))
  const featuredEvents = eventsWithAvailability.slice(0, 3)
  const regularEvents = eventsWithAvailability.slice(3)

  return (
    <div className="min-h-screen bg-background">
      <section className="relative flex min-h-[500px] items-center overflow-hidden py-16 sm:min-h-[600px] sm:py-20" style={{ backgroundImage: 'url(/tekateka-home.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/80 to-background/55 sm:bg-gradient-to-r sm:from-background sm:via-background/80 sm:to-background/40" />
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl teka-editorial">
            <Image src="/tekateka-mark.png" alt="Isotipo TekaTeka" width={72} height={72} className="mb-5 h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16" priority />
            <div className="mb-8">
              <p className="mb-4 max-w-full text-xs font-bold uppercase tracking-[0.16em] text-primary sm:mb-5 sm:text-sm sm:tracking-[0.24em]">Más cultura. Más encuentros.</p>
              <h1 className="max-w-2xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-balance sm:text-6xl md:text-8xl">
                Descubrí qué está pasando cerca tuyo.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:mt-7 sm:text-xl md:text-2xl">Eventos, música, teatro, fiestas y encuentros independientes.</p>
              <Button asChild size="lg" className="mt-7 w-full rounded-full px-7 font-bold sm:mt-8 sm:w-auto"><Link href="/eventos">Ver eventos disponibles <span aria-hidden="true">→</span></Link></Button>
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
