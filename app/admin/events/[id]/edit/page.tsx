import { redirect, notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  const { authorized, user } = await requireAuth(["organizer"])

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
    <>
      <Card>
        <CardHeader>
          <CardTitle>Editar evento</CardTitle>
          <CardDescription>Actualizá la información del evento</CardDescription>
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
    </>
  )
}
