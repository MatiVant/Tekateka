import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Ticket, Eye, Edit, BarChart3 } from "lucide-react"
import Link from "next/link"
import { formatPrice } from "@/lib/format"
import { ArchiveEventButton } from "@/components/admin/archive-event-button"
import { DeleteEventButton } from "@/components/superadmin/delete-event-button"
import { ShareEventButton } from "@/components/admin/share-event-button"
import { EventVisibilityToggle } from "@/components/admin/event-visibility-toggle"

interface EventsListProps {
  userId: string
  showArchived?: boolean
}

export async function EventsList({ userId, showArchived = false }: EventsListProps) {
  const supabase = await createClient()

  const query = supabase.from("events").select("*").eq("organizer_id", userId)

  if (showArchived) {
    query.eq("status", "finished")
  }

  const { data: queriedEvents } = await query
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const events = showArchived
    ? (queriedEvents || []).filter((event) => new Date(event.event_date) < yesterday)
    : (queriedEvents || []).filter((event) => event.status !== "finished" || new Date(event.event_date) >= yesterday)
  const { data: eventTickets } = await supabase.from("tickets").select("event_id, status, payment_status")
  const salesByEvent = (eventTickets || []).reduce<Record<string, { confirmed: number; pending: number }>>((counts, ticket) => {
    const current = counts[ticket.event_id] || { confirmed: 0, pending: 0 }
    if (ticket.status === "confirmed" || ticket.payment_status === "approved") current.confirmed += 1
    else if (ticket.status === "pending") current.pending += 1
    counts[ticket.event_id] = current
    return counts
  }, {})
  const now = Date.now()
  const sortedEvents = [...(events || [])].sort((a, b) => {
    const aTime = new Date(a.event_date).getTime()
    const bTime = new Date(b.event_date).getTime()
    const aFuture = aTime >= now
    const bFuture = bTime >= now
    if (aFuture !== bFuture) return aFuture ? -1 : 1
    return aFuture ? aTime - bTime : bTime - aTime
  })

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
      {sortedEvents.map((event) => {
        const isPastEvent = new Date(event.event_date) < new Date()
        const sales = salesByEvent[event.id] || { confirmed: 0, pending: 0 }
        const available = Math.max(0, event.total_tickets - sales.confirmed)
        const salesPercentage = event.total_tickets > 0 ? Math.round((sales.confirmed / event.total_tickets) * 100) : 0

        return (
          <div
            key={event.id}
            className="relative flex min-w-0 flex-col items-stretch gap-4 overflow-hidden rounded-xl border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:p-4"
          >
            <div className="h-44 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
              <img
                src={
                  event.image_url || `/placeholder.svg?height=100&width=100&query=${encodeURIComponent(event.title)}`
                }
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
              <EventVisibilityToggle eventId={event.id} isPublic={event.is_public !== false} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 font-semibold text-lg text-pretty line-clamp-2">{event.title}</h3>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pr-10 sm:pr-12">
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(event.event_date).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "America/Argentina/Buenos_Aires",
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
                    {available} / {event.total_tickets} disponibles
                  </span>
                </div>

                <div className="flex items-center gap-2 font-semibold text-foreground">${formatPrice(event.price)}</div>
              </div>

              <div className="mb-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium"><BarChart3 className="h-4 w-4 text-primary" />Ventas</span>
                  <span className="font-semibold">{sales.confirmed} / {event.total_tickets} ({salesPercentage}%)</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, salesPercentage)}%` }} /></div>
                {sales.pending > 0 && <p className="mt-1 text-xs text-muted-foreground">{sales.pending} pendiente{sales.pending === 1 ? "" : "s"} de confirmación</p>}
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button variant="outline" size="sm" className="min-w-0" asChild>
                  <Link href={`/events/${event.slug || event.id}`}>
                    <Eye className="mr-1 h-3 w-3" />
                    Ir al evento
                  </Link>
                </Button>
                <ShareEventButton eventId={event.id} eventTitle={event.title} eventSlug={event.slug} />
                {event.status !== "finished" && (
                  <Button variant="outline" size="sm" className="min-w-0" asChild>
                    <Link href={`/admin/events/${event.id}/edit`} className="min-w-0">
                      <Edit className="mr-1 h-3 w-3" />
                      Ver/Editar
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="min-w-0" asChild>
                  <Link href={`/admin/events/${event.id}/tickets`} className="min-w-0">
                    <Ticket className="mr-1 h-3 w-3" />
                    Entradas
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
