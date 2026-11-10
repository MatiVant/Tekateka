import Link from "next/link"
import Image from "next/image"
import { ArrowUpRight, ChevronRight, MapPin, Sparkles } from "lucide-react"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { EventCard } from "@/components/event-card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Este orden define qué espacio aparece primero en la home.
const SPACE_PRIORITY = ["la lengua del juglar"]
const MAX_EVENTS_PER_SPACE = 3

function normalizeSpace(value: string | null) {
  return value?.trim().toLocaleLowerCase("es-AR") || "sin espacio"
}

export default async function HomeTwoPage() {
  const supabase = createAdminClient()
  const now = new Date()
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_public", true)
    .gte("event_date", now.toISOString())
    .in("status", ["active", "inactive", "sold_out"])
    .order("event_date", { ascending: true })

  const eventIds = (events ?? []).map((event) => event.id)
  const [{ data: tickets }, { data: doorSales }, { data: tiers }] = await Promise.all([
    eventIds.length ? supabase.from("tickets").select("event_id").in("event_id", eventIds).in("status", ["pending", "confirmed", "used"]) : Promise.resolve({ data: [] }),
    eventIds.length ? supabase.from("door_sales").select("event_id, quantity").in("event_id", eventIds) : Promise.resolve({ data: [] }),
    eventIds.length ? supabase.from("ticket_tiers").select("event_id, base_price").in("event_id", eventIds).order("base_price", { ascending: true }) : Promise.resolve({ data: [] }),
  ])

  const soldByEvent = (tickets ?? []).reduce<Record<string, number>>((result, ticket) => {
    result[ticket.event_id] = (result[ticket.event_id] || 0) + 1
    return result
  }, {})
  for (const sale of doorSales ?? []) soldByEvent[sale.event_id] = (soldByEvent[sale.event_id] || 0) + Number(sale.quantity || 0)
  const minPriceByEvent = (tiers ?? []).reduce<Record<string, number>>((result, tier) => {
    if (result[tier.event_id] === undefined) result[tier.event_id] = tier.base_price
    return result
  }, {})
  const preparedEvents = (events ?? []).map((event) => ({
    ...event,
    confirmed_count: soldByEvent[event.id] || 0,
    min_price: minPriceByEvent[event.id] ?? null,
  }))

  // La selección destacada se muestra una sola vez para no repetirla dentro del espacio.
  const featured = preparedEvents.slice(0, 3)
  const featuredIds = new Set(featured.map((event) => event.id))
  const remainingEvents = preparedEvents.filter((event) => !featuredIds.has(event.id))
  const grouped = new Map<string, typeof remainingEvents>()
  for (const event of remainingEvents) {
    const key = normalizeSpace(event.venue)
    grouped.set(key, [...(grouped.get(key) ?? []), event])
  }
  const spaces = Array.from(grouped.entries()).sort(([a], [b]) => {
    const aIndex = SPACE_PRIORITY.indexOf(a)
    const bIndex = SPACE_PRIORITY.indexOf(b)
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
    return a.localeCompare(b, "es")
  })

  return (
    <main className="min-h-screen bg-[#fbf8f2] text-[#25211d]">
      <section className="relative flex min-h-[500px] items-center overflow-hidden py-16 sm:min-h-[600px] sm:py-20" style={{ backgroundImage: "url(/tekateka-home.png)", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/80 to-background/55 sm:bg-gradient-to-r sm:from-background sm:via-background/80 sm:to-background/40" />
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl teka-editorial">
            <Image src="/tekateka-mark.png" alt="Isotipo TekaTeka" width={72} height={72} className="mb-5 h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16" priority />
            <div className="mb-8">
              <p className="mb-4 max-w-full text-xs font-bold uppercase tracking-[0.16em] text-primary sm:mb-5 sm:text-sm sm:tracking-[0.24em]">Más cultura. Más encuentros.</p>
              <h1 className="max-w-2xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-balance sm:text-6xl md:text-8xl">Descubrí qué está pasando cerca tuyo.</h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:mt-7 sm:text-xl md:text-2xl">Eventos, música, teatro, fiestas y encuentros independientes.</p>
              <Button asChild size="lg" className="mt-7 w-full rounded-full px-7 font-bold sm:mt-8 sm:w-auto"><Link href="#destacados">Ver eventos disponibles <span aria-hidden="true">→</span></Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section id="destacados" className="bg-[#25211d] py-12 text-[#fbf8f2] sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e9b84d]">Selección TekaTeka</p><h2 className="mt-2 text-4xl font-black tracking-[-.06em]">Destacados</h2></div><span className="hidden max-w-48 text-right text-sm text-white/55 sm:block">Lo que hoy queremos poner en primer plano</span></div>
          {featured.length ? <div className="grid auto-rows-[190px] grid-cols-1 gap-4 sm:grid-cols-12 sm:auto-rows-[135px]">{featured.map((event, index) => {
            const imageUrl = event.image_url || `/placeholder.svg?height=600&width=900&query=evento+${encodeURIComponent(event.title)}`
            const date = new Date(event.event_date).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" })
            const cardSize = index === 0 ? "sm:col-span-7 sm:row-span-3" : index === 1 ? "sm:col-span-5 sm:row-span-2" : "sm:col-span-5 sm:row-span-1"
            return <Link key={event.id} href={`/events/${event.slug || event.id}`} className={`group relative isolate overflow-hidden rounded-[1.5rem] bg-[#554b42] shadow-[0_16px_45px_rgba(0,0,0,.28)] ${cardSize}`}>
              <Image src={imageUrl} alt={event.title} fill sizes={index === 0 ? "(max-width: 640px) 100vw, 58vw" : "(max-width: 640px) 100vw, 42vw"} className="object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171310] via-[#171310]/15 to-black/5" />
              <span className="absolute left-4 top-4 rounded-full bg-[#f9ce68] px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-[#25211d]">{index === 0 ? "Imperdible" : "Selección"}</span>
              {index === 0 ? <div className="absolute inset-x-5 bottom-5"><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[#f9ce68]">{event.venue || "TekaTeka"} · {date}</p><h3 className="max-w-xl text-3xl font-black leading-[.95] tracking-[-.05em] text-white sm:text-5xl">{event.title}</h3><p className="mt-3 text-sm font-semibold text-white/75">Entradas desde {formatCurrency(event.min_price ?? event.price)}</p></div> : index === 1 ? <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3"><div><p className="mb-1 text-xs font-semibold text-white/70">{date}</p><h3 className="text-2xl font-black leading-none tracking-[-.04em] text-white">{event.title}</h3></div><span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#25211d]">Ver evento</span></div> : <div className="absolute inset-x-4 bottom-4"><h3 className="text-xl font-black leading-none tracking-[-.04em] text-white">{event.title}</h3><p className="mt-1 text-xs font-semibold text-white/70">{event.venue || "Próximo evento"}</p></div>}
            </Link>
          })}</div> : <p className="rounded-xl border border-white/15 p-8 text-center text-white/60">Todavía no hay eventos publicados.</p>}
        </div>
      </section>

      <section className="border-y border-[#e8dfd1] bg-[#f1eadf]">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Descubrí</p><h2 className="mt-2 text-4xl font-black tracking-[-.06em]">Por espacio</h2></div><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Cada lugar tiene su propio pulso. Mostramos una selección y dejamos el resto a un clic.</p></div>
          <div className="space-y-12">
            {spaces.length ? spaces.map(([spaceKey, spaceEvents]) => { const visibleEvents = spaceEvents.slice(0, MAX_EVENTS_PER_SPACE); return <section key={spaceKey} aria-labelledby={`space-${spaceKey}`}>
              <div className="mb-5 flex items-center justify-between gap-4"><div><h3 id={`space-${spaceKey}`} className="flex items-center gap-2 text-2xl font-black tracking-[-.05em] sm:text-3xl"><MapPin className="h-5 w-5 text-primary" />{spaceEvents[0].venue || "Sin espacio informado"}</h3><p className="mt-1 text-sm text-muted-foreground">{spaceEvents.length} {spaceEvents.length === 1 ? "evento próximo" : "eventos próximos"}</p></div><Link href={`/eventos?espacio=${encodeURIComponent(spaceEvents[0].venue || "")}`} className="group flex shrink-0 items-center gap-1 rounded-full border border-[#cfc3b3] bg-[#fbf8f2] px-3 py-2 text-sm font-bold transition hover:border-primary hover:text-primary">Ver más <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link></div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visibleEvents.map((event) => <EventCard key={event.id} event={event} />)}</div>
            </section> }) : <p className="rounded-xl border border-[#d8cebf] bg-[#fbf8f2] p-8 text-center text-muted-foreground">Pronto vas a poder descubrir nuevos espacios.</p>}
          </div>
        </div>
      </section>

      <footer className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8"><span className="font-semibold">Más cultura. Más encuentros.</span><Link href="/eventos" className="font-semibold text-primary">Toda la agenda <ChevronRight className="inline h-4 w-4" /></Link></footer>
    </main>
  )
}
