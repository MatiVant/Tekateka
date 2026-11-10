import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { EventCard } from "@/components/event-card"
import { CalendarDays, ChevronRight, MapPin, Ticket } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Eventos disponibles | TekaTeka",
  description: "Encontrá eventos con entradas disponibles y comprá la tuya en TekaTeka.",
}

type EventsPageProps = {
  searchParams: Promise<{ espacio?: string }>
}

function normalizeSpace(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("es-AR") || ""
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const { espacio } = await searchParams
  const selectedSpace = normalizeSpace(espacio)
  const supabase = createAdminClient()
  const now = new Date()

  const { data: events } = await supabase
    .from("events")
    .select("*, venues(name, cover_image_url)")
    .eq("is_public", true)
    .eq("status", "active")
    .gte("event_date", now.toISOString())
    .order("event_date", { ascending: true })

  const eventIds = (events ?? []).map((event) => event.id)
  const [{ data: confirmedTickets }, { data: doorSales }] = await Promise.all([
    eventIds.length ? supabase.from("tickets").select("event_id").in("event_id", eventIds).in("status", ["pending", "confirmed", "used"]) : Promise.resolve({ data: [] }),
    eventIds.length ? supabase.from("door_sales").select("event_id, quantity").in("event_id", eventIds) : Promise.resolve({ data: [] }),
  ])

  const confirmedByEvent = (confirmedTickets ?? []).reduce<Record<string, number>>((counts, ticket) => {
    counts[ticket.event_id] = (counts[ticket.event_id] ?? 0) + 1
    return counts
  }, {})
  const doorSalesByEvent = (doorSales ?? []).reduce<Record<string, number>>((counts, sale) => {
    counts[sale.event_id] = (counts[sale.event_id] ?? 0) + Number(sale.quantity ?? 0)
    return counts
  }, {})
  const availableEvents = (events ?? []).filter((event) => {
    const startsAt = new Date(event.event_date).getTime()
    const salesStart = event.sales_start_at ? new Date(event.sales_start_at).getTime() : null
    const salesEnd = event.sales_end_at ? new Date(event.sales_end_at).getTime() : null
    const remaining = Number(event.total_tickets ?? 0) - (confirmedByEvent[event.id] ?? 0) - (doorSalesByEvent[event.id] ?? 0)
    return startsAt > now.getTime() && (salesStart === null || salesStart <= now.getTime()) && (salesEnd === null || salesEnd > now.getTime()) && remaining > 0
  }).map((event) => ({
    ...event,
    venue: event.venues?.name || event.venue,
    confirmed_count: (confirmedByEvent[event.id] ?? 0) + (doorSalesByEvent[event.id] ?? 0),
  }))

  const spacesMap = new Map<string, { label: string | null; image: string | null; count: number }>()
  for (const event of availableEvents) {
    const key = normalizeSpace(event.venue)
    const current = spacesMap.get(key)
    spacesMap.set(key, { label: current?.label || event.venue, image: current?.image || event.venues?.cover_image_url || event.image_url, count: (current?.count || 0) + 1 })
  }
  const spaces = Array.from(spacesMap.entries())
  const visibleEvents = selectedSpace ? availableEvents.filter((event) => normalizeSpace(event.venue) === selectedSpace) : []
  const selectedSpaceLabel = visibleEvents[0]?.venue || espacio || ""

  return (
    <main className="min-h-screen bg-background">
      <section className="relative min-h-[340px] overflow-hidden border-b border-[#302a25] bg-[#25211d] text-white sm:min-h-[400px]" style={{ backgroundImage: "url(/tekateka-home.png)", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-[#171310]/95 via-[#25211d]/75 to-[#25211d]/35" />
        <div className="container relative mx-auto flex min-h-[340px] items-end px-4 py-12 sm:min-h-[400px] sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 py-2 text-sm font-semibold text-[#f9ce68] backdrop-blur-sm"><CalendarDays className="h-4 w-4" />Agenda abierta</div>
            <h1 className="max-w-3xl text-4xl font-black leading-[.95] tracking-[-0.06em] text-balance sm:text-6xl md:text-7xl">Elegí dónde querés encontrarte.</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">Cada espacio tiene su propio pulso. Entrá, descubrí su agenda y elegí tu próximo evento.</p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/80"><Ticket className="h-4 w-4 text-[#f9ce68]" />{availableEvents.length} {availableEvents.length === 1 ? "evento disponible" : "eventos disponibles"}</div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {!selectedSpace && <>
            <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Dónde sucede</p><h2 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">Espacios</h2></div></div>
            {spaces.length ? <div className="space-y-5">{spaces.map(([spaceKey, space]) => <Link key={spaceKey} href={`/eventos?espacio=${encodeURIComponent(space.label || "")}`} className="group relative isolate flex min-h-[220px] overflow-hidden rounded-[1.5rem] border border-black/10 transition hover:-translate-y-1 hover:shadow-xl sm:min-h-[260px]">
              <Image src={space.image || "/tekateka-home.png"} alt={space.label || "Espacio TekaTeka"} fill sizes="(max-width: 640px) 100vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#171310]/90 via-[#25211d]/55 to-[#25211d]/10" />
              <div className="relative flex w-full flex-col justify-end p-6 sm:p-8"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-[#f9ce68] backdrop-blur-sm"><MapPin className="h-5 w-5" /></div><h3 className="max-w-2xl text-3xl font-black tracking-[-.05em] text-white sm:text-5xl">{space.label || "Sin espacio informado"}</h3><div className="mt-3 flex items-center gap-4 text-sm font-semibold text-white/75"><span>{space.count} {space.count === 1 ? "evento próximo" : "eventos próximos"}</span><span className="flex items-center gap-1 text-[#f9ce68]">Entrar al espacio <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></div>
            </Link>)}</div> : <p className="rounded-xl border p-8 text-center text-muted-foreground">Por ahora no hay espacios con eventos disponibles.</p>}
          </>}

          {selectedSpace && <div className="mt-16 border-t pt-10"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Agenda del espacio</p><h2 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">{selectedSpaceLabel}</h2></div><div className="flex items-center gap-4"><span className="text-sm text-muted-foreground">{visibleEvents.length} {visibleEvents.length === 1 ? "evento" : "eventos"}</span><Link href="/eventos" className="text-sm font-semibold text-primary">Cambiar espacio</Link></div></div>{visibleEvents.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{visibleEvents.map((event) => <EventCard key={event.id} event={event} />)}</div> : <p className="rounded-xl border p-8 text-center text-muted-foreground">No hay eventos disponibles en este espacio.</p>}</div>}
        </div>
      </section>
    </main>
  )
}
