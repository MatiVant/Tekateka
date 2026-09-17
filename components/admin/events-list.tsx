import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Ticket, Eye, Edit } from "lucide-react"
import Link from "next/link"
import { formatPrice } from "@/lib/format"
import { ArchiveEventButton } from "@/components/admin/archive-event-button"
import { DeleteEventButton } from "@/components/superadmin/delete-event-button"
import { ShareEventButton } from "@/components/admin/share-event-button"

interface EventsListProps {
  userId: string
  showArchived?: boolean
}

export async function EventsList({ userId, showArchived = false }: EventsListProps) {
  const supabase = await createClient()

  const query = supabase.from("events").select("*").eq("organizer_id", userId).order("event_date", { ascending: true })

  if (showArchived) {
    query.eq("status", "finished")
  } else {
    query.in("status", ["active", "inactive", "sold_out"])
  }

  const { data: events } = await query

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          {showArchived ? "No tienes eventos archivados" : "No has creado ningún evento aún"}
        </p>
        {!showArchived && (
          <Button asChild>
            <Link href="/admin/events/new">Crear tu primer evento</Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const isPastEvent = new Date(event.event_date) < new Date()

        return (
          <div
            key={event.id}
            className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              <img
                src={
                  event.image_url || `/placeholder.svg?height=100&width=100&query=${encodeURIComponent(event.title)}`
                }
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg text-pretty line-clamp-1">{event.title}</h3>
                <Badge
                  variant={
                    event.status === "active"
                      ? "default"
                      : event.status === "finished"
                        ? "secondary"
                        : event.status === "sold_out"
                          ? "secondary"
                          : "secondary"
                  }
                >
                  {event.status === "active"
                    ? "Activo"
                    : event.status === "sold_out"
                      ? "Agotado"
                      : event.status === "finished"
                        ? "Finalizado"
                        : "Inactivo"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(event.event_date).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{event.venue}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  <span>
                    {event.available_tickets} / {event.total_tickets} disponibles
                  </span>
                </div>

                <div className="flex items-center gap-2 font-semibold text-foreground">${formatPrice(event.price)}</div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/events/${event.slug || event.id}`}>
                    <Eye className="mr-1 h-3 w-3" />
                    Ver
                  </Link>
                </Button>
                <ShareEventButton eventId={event.id} eventTitle={event.title} eventSlug={event.slug} />
                {event.status !== "finished" && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/events/${event.id}/edit`}>
                      <Edit className="mr-1 h-3 w-3" />
                      Editar
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/events/${event.id}/tickets`}>
                    <Ticket className="mr-1 h-3 w-3" />
                    Tickets
                  </Link>
                </Button>
                <ArchiveEventButton eventId={event.id} isArchived={event.status === "finished"} />
                {showArchived && event.status === "finished" && (
                  <DeleteEventButton eventId={event.id} eventTitle={event.title} />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
