import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import Image from "next/image"
import { EventCard } from "@/components/event-card"
import { slugify } from "@/lib/slugify"
import { CalendarDays, Ticket } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { OrganizerCoverAdminEditor } from "@/components/organizer-cover-admin-editor"

type OrganizerPageProps = {
  params: Promise<{ organizerSlug: string }>
}

export const dynamic = "force-dynamic"
export const revalidate = 0

async function findOrganizerBySlug(organizerSlug: string) {
  const supabase = createAdminClient()
  const { data: organizers, error } = await supabase
    .from("profiles")
    .select("id, full_name, organization_name, organization_cover_image_url")
    .not("full_name", "is", null)

  if (error) throw error

  const normalizedSlug = slugify(organizerSlug)
  const matchedOrganizer = (organizers ?? []).find((organizer) =>
    slugify(organizer.organization_name?.trim() || organizer.full_name?.trim() || "") === normalizedSlug,
  )
  if (!matchedOrganizer) return null

  const organizationName = matchedOrganizer.organization_name?.trim() || matchedOrganizer.full_name?.trim() || ""
  const organizationProfiles = (organizers ?? []).filter((organizer) =>
    (organizer.organization_name?.trim() || organizer.full_name?.trim() || "").toLocaleLowerCase() === organizationName.toLocaleLowerCase(),
  )

  return {
    organizationName,
    organizerProfileId: matchedOrganizer.id,
    organizationCoverImageUrl: matchedOrganizer.organization_cover_image_url,
    organizerIds: organizationProfiles.map((organizer) => organizer.id),
  }
}

export async function generateMetadata({ params }: OrganizerPageProps): Promise<Metadata> {
  const { organizerSlug } = await params
  const organizer = await findOrganizerBySlug(organizerSlug)

  return organizer
    ? {
        title: `${organizer.organizationName} | TekaTeka`,
        description: `Todos los eventos de ${organizer.organizationName} en TekaTeka.`,
      }
    : { title: "Organizador no encontrado | TekaTeka" }
}

export default async function OrganizerPublicPage({ params }: OrganizerPageProps) {
  const { organizerSlug } = await params
  const organizer = await findOrganizerBySlug(organizerSlug)

  if (!organizer) notFound()

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  const { data: currentProfile } = user
    ? await sessionSupabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null }
  const canEditCover =
    currentProfile?.role === "superadmin" ||
    (currentProfile?.role === "organizer" && user?.id === organizer.organizerProfileId)

  const supabase = createAdminClient()
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("is_public", true)
    .gte("event_date", new Date().toISOString())
    .in("organizer_id", organizer.organizerIds)
    .order("event_date", { ascending: true })

  if (error) throw error

  const eventIds = (events ?? []).map((event) => event.id)
  const { data: confirmedTickets } = eventIds.length
    ? await supabase.from("tickets").select("event_id").in("event_id", eventIds).in("status", ["pending", "confirmed", "used"])
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
      <section className="relative isolate min-h-[420px] overflow-hidden border-b border-border bg-[#f4eddf] sm:min-h-[480px] lg:aspect-[8/3] lg:min-h-0">
        {organizer.organizationCoverImageUrl && (
          <>
            <Image
              src={organizer.organizationCoverImageUrl}
              alt=""
              fill
              priority
              unoptimized
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/20" aria-hidden="true" />
          </>
        )}
        {canEditCover && (
          <div className="absolute right-4 top-4 z-20 w-[calc(100%-2rem)] sm:right-8 sm:top-8 sm:w-auto">
            <OrganizerCoverAdminEditor
              organizerProfileId={organizer.organizerProfileId}
              currentCoverUrl={organizer.organizationCoverImageUrl}
            />
          </div>
        )}
        <div className="container relative mx-auto px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h1 className={`max-w-3xl text-4xl font-black leading-tight tracking-[-0.05em] text-balance sm:text-5xl md:text-6xl ${organizer.organizationCoverImageUrl ? "text-white" : "text-foreground"}`}>
              {organizer.organizationName}
            </h1>
            <p className={`mt-3 max-w-2xl text-sm leading-relaxed sm:text-base ${organizer.organizationCoverImageUrl ? "text-white/85" : "text-muted-foreground"}`}>
              Próximos eventos de este espacio.
            </p>
            <div className={`mt-6 inline-flex items-center gap-2 text-sm font-medium ${organizer.organizationCoverImageUrl ? "text-white/90" : "text-foreground/75"}`}>
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
