import { redirect, notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Ticket } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { EventForm } from "@/components/admin/event-form"
import { EventOwnershipTransfer } from "@/components/admin/event-ownership-transfer"
import { getPendingTransfersForEvent } from "@/app/actions/event-ownership-transfer"
import { getAudienceTags } from "@/app/actions/audience-tags"
import { getMyPendingVenueProposals } from "@/lib/venue-proposals"

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { authorized, user, profile } = await requireAuth(["organizer"])

  if (!authorized || !user) {
    redirect("/auth/login")
  }

  const supabase = await createClient()
  const currentTransfer = await getPendingTransfersForEvent(id)
  const audienceTags = await getAudienceTags()

  const [{ data: event }, { data: venues }, pendingVenueProposals, { count: ticketTierCount }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).eq("organizer_id", user.id).single(),
    supabase.from("venues").select("id, name, address").eq("active", true).order("name"),
    getMyPendingVenueProposals(user.id),
    supabase.from("ticket_tiers").select("id", { count: "exact", head: true }).eq("event_id", id),
  ])

  if (!event) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-muted/30">

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Panel
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/admin/events/${id}/tickets`}>
              <Ticket className="mr-2 h-4 w-4" />
              Ver Tickets
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Editar Evento</CardTitle>
            <CardDescription>Actualiza la información del evento</CardDescription>
          </CardHeader>
          <CardContent>
            <EventForm
              userId={user.id}
              event={event}
              venues={venues ?? []}
              pendingVenueProposals={pendingVenueProposals}
              audienceTagOptions={audienceTags.filter((tag) => tag.active).map((tag) => tag.name)}
              ticketSettingsHref={`/admin/events/${id}/settings`}
              hasExistingTicketTiers={(ticketTierCount ?? 0) > 0}
            />
          </CardContent>
        </Card>

        <EventOwnershipTransfer eventId={id} currentTransfer={currentTransfer} />
      </main>
    </div>
  )
}
