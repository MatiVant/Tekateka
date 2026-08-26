import { createClient as createServerClient } from "@/lib/supabase/server"
import { requireAuth, getCurrentUser } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Ticket, DollarSign, Users } from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/format"
import { DeleteEventButton } from "@/components/superadmin/delete-event-button"

export default async function SuperAdminEventsPage() {
  await requireAuth(["superadmin"])
  const userData = await getCurrentUser()
  const user = userData?.user

  const supabase = await createServerClient()

  const { data: events, error } = await supabase
    .from("events")
    .select(
      `
      *,
      profiles!events_organizer_id_fkey(email, full_name)
    `,
    )
    .order("event_date", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching events:", error)
  }

  const allEvents = events || []

  const { data: ticketsData } = await supabase.from("tickets").select("event_id, status, final_price")

  const ticketsByEvent = ticketsData?.reduce(
    (acc, ticket) => {
      if (!acc[ticket.event_id]) {
        acc[ticket.event_id] = {
          total: 0,
          confirmed: 0,
          pending: 0,
          revenue: 0,
        }
      }
      acc[ticket.event_id].total++
      if (ticket.status === "confirmed") {
        acc[ticket.event_id].confirmed++
        acc[ticket.event_id].revenue += ticket.final_price || 0
      }
      if (ticket.status === "pending") {
        acc[ticket.event_id].pending++
      }
      return acc
    },
    {} as Record<string, { total: number; confirmed: number; pending: number; revenue: number }>,
  )

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Todos los Eventos</h1>
          <p className="text-muted-foreground mt-2">Vista completa de todos los eventos en la plataforma</p>
        </div>

        <div className="grid gap-6 mb-8 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allEvents.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eventos Activos</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allEvents.filter((e) => e.status === "active").length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(ticketsByEvent || {}).reduce((sum, t) => sum + t.total, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(Object.values(ticketsByEvent || {}).reduce((sum, t) => sum + t.revenue, 0))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {allEvents.map((event) => {
            const stats = ticketsByEvent?.[event.id] || { total: 0, confirmed: 0, pending: 0, revenue: 0 }
            const eventDate = new Date(event.event_date)

            return (
              <Card key={event.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-3">
                      <img
                        src={
                          event.image_url ||
                          `/placeholder.svg?height=200&width=300&query=evento+${encodeURIComponent(event.title) || "/placeholder.svg"}`
                        }
                        alt={event.title}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>

                    <div className="lg:col-span-5 space-y-3">
                      <div>
                        <Link href={`/events/${event.id}`} className="hover:underline">
                          <h3 className="text-xl font-bold">{event.title}</h3>
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">
                          Por: {event.profiles?.full_name || event.profiles?.email}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant={event.status === "active" ? "default" : "secondary"}>{event.status}</Badge>
                        {event.price === 0 && <Badge variant="outline">Gratis</Badge>}
                        {event.is_pay_what_you_want && <Badge variant="outline">A la gorra</Badge>}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {eventDate.toLocaleDateString("es-ES", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{event.venue}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">
                            {event.price === 0 && !event.is_pay_what_you_want && "Gratis"}
                            {event.is_pay_what_you_want && "A la gorra"}
                            {event.price > 0 && !event.is_pay_what_you_want && formatCurrency(event.price)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-xs text-muted-foreground mb-1">Entradas Totales</p>
                          <p className="text-2xl font-bold">{event.total_tickets}</p>
                          <p className="text-xs text-muted-foreground mt-1">{event.available_tickets} disponibles</p>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-xs text-muted-foreground mb-1">Vendidas</p>
                          <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
                          <p className="text-xs text-muted-foreground mt-1">{stats.pending} pendientes</p>
                        </div>

                        <div className="col-span-2 bg-primary/10 rounded-lg p-4">
                          <p className="text-xs text-muted-foreground mb-1">Ingresos Confirmados</p>
                          <p className="text-2xl font-bold text-primary">{formatCurrency(stats.revenue)}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <DeleteEventButton eventId={event.id} eventTitle={event.title} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {allEvents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No hay eventos creados aún</div>
          )}
        </div>
      </main>
    </div>
  )
}
