import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { EventCard } from "@/components/event-card"
import { slugify } from "@/lib/slugify"
import { CalendarDays, Ticket } from "lucide-react"

type OrganizerPageProps = {
  params: Promise<{ organizerSlug: string }>
}

export const dynamic = "force-dynamic"
export const revalidate = 0

async function findOrganizerBySlug(organizerSlug: string) {
  const supabase = createAdminClient()
  const { data: organizers, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .not("full_name", "is", null)

  if (error) throw error
  return (organizers ?? []).find((organizer) => slugify(organizer.full_name || "") === organizerSlug) ?? null
}

export async function generateMetadata({ params }: OrganizerPageProps): Promise<Metadata> {
  const { organizerSlug } = await params
  const organizer = await findOrganizerBySlug(organizerSlug)

  return organizer
    ? {
        title: `${organizer.full_name} | TekaTeka`,
        description: `Todos los eventos de ${organizer.full_name} en TekaTeka.`,
      }
    : { title: "Organizador no encontrado | TekaTeka" }
}

export default async function OrganizerPublicPage({ params }: OrganizerPageProps) {
  const { organizerSlug } = await params
  const organizer = await findOrganizerBySlug(organizerSlug)

  if (!organizer) notFound()

  const supabase = createAdminClient()
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizer.id)
    .order("event_date", { ascending: true })

  if (error) throw error

  const eventIds = (events ?? []).map((event) => event.id)
  const { data: confirmedTickets } = eventIds.length
    ? await supabase.from("tickets").select("event_id").in("event_id", eventIds).eq("status", "confirmed")
    : { data: [] as { event_id: string }[] }

  const confirmedByEvent = (confirmedTickets ?? []).reduce<Record<string, number>>((counts, ticket) => {
    counts[ticket.event_id] = (counts[ticket.event_id] ?? 0) + 1
    return counts
  }, {})

  const organizerEvents = (events ?? []).map((event) => ({
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
              Organizador
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-[-0.05em] text-balance sm:text-5xl md:text-6xl">
              {organizer.full_name}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Todos sus eventos, pasados y próximos.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground/75">
              <Ticket className="h-4 w-4 text-primary" />
              {organizerEvents.length} {organizerEvents.length === 1 ? "evento" : "eventos"}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {organizerEvents.length > 0 ? (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {organizerEvents.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        ) : (
          <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold">Todavía no hay eventos publicados</h2>
            <p className="mt-2 text-muted-foreground">Cuando haya eventos, los vas a encontrar acá.</p>
          </div>
        )}
      </section>
    </main>
  )
}
