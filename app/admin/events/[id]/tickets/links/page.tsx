import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getArtistShareLinks } from "@/app/actions/artist-share-links"
import { ArtistShareLinks } from "@/components/admin/artist-share-links"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

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
    <main className="container mx-auto min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" className="w-fit">
          <Link href={`/admin/events/${id}/tickets`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a entradas vendidas
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-fit">
          <Link href={`/admin/events/${id}/tickets`}>
            Ver entradas vendidas
          </Link>
        </Button>
      </div>

      <section className="mx-auto max-w-4xl">
        <p className="mb-4 text-sm text-muted-foreground">Evento: {event.title}</p>
        <ArtistShareLinks eventId={id} initialLinks={shareLinks} />
      </section>
    </main>
  )
}
