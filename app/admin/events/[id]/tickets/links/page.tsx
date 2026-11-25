import { notFound, redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getArtistShareLinks } from "@/app/actions/artist-share-links"
import { ArtistShareLinks } from "@/components/admin/artist-share-links"

export default async function EventTicketLinksPage({
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
  let eventQuery = supabase.from("events").select("id, title, organizer_id").eq("id", id)

  if (profile?.role !== "superadmin") {
    eventQuery = eventQuery.eq("organizer_id", user.id)
  }

  const { data: event } = await eventQuery.maybeSingle()

  if (!event) {
    notFound()
  }

  const shareLinks = await getArtistShareLinks(id)

  return (
    <section className="mx-auto max-w-4xl">
      <ArtistShareLinks eventId={id} initialLinks={shareLinks} />
    </section>
  )
}
