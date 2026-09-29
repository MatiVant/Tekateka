import Link from "next/link"
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  LayoutList,
  MessageSquareText,
  Tags,
  Ticket,
  Users,
  Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"

type DashboardEvent = {
  id: string
  title: string
  status: string | null
  event_date: string | null
  venue: string | null
  slug: string | null
}

type SuperAdminDashboardProps = {
  metrics: {
    events: number
    tickets: number
    sales: number
    organizers: number
    pendingOrganizers: number
    activeSubscriptions: number
  }
  events: DashboardEvent[]
}

const sections = [
  { title: "Todos los eventos", description: "Buscar y administrar eventos", href: "/superadmin/events", icon: LayoutList },
  { title: "Usuarios y organizadores", description: "Solicitudes, cuentas y suscripciones", href: "#organizers", icon: Users },
  { title: "Categorías", description: "Administrar etiquetas disponibles", href: "#categories", icon: Tags },
  { title: "Audiencias", description: "Intereses y recomendaciones", href: "#audiences", icon: CalendarDays },
  { title: "Mensajes", description: "Bandeja de consultas", href: "#messages", icon: MessageSquareText },
  { title: "Movimientos", description: "Reporte financiero de la plataforma", href: "#movements", icon: Wallet },
]

function formatEventDate(value: string | null) {
  if (!value) return "Fecha sin definir"

  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  })
}

function statusLabel(status: string | null) {
  if (status === "active") return "Activo"
  if (status === "cancelled" || status === "canceled") return "Cancelado"
  if (status === "completed") return "Finalizado"
  return status ? status.charAt(0).toLocaleUpperCase("es-AR") + status.slice(1) : "Sin estado"
}

export function SuperAdminDashboard({ metrics, events }: SuperAdminDashboardProps) {
  const metricCards = [
    { title: "Eventos", value: metrics.events.toLocaleString("es-AR"), note: "En toda la plataforma", icon: CalendarDays },
    { title: "Entradas", value: metrics.tickets.toLocaleString("es-AR"), note: "Emitidas", icon: Ticket },
    { title: "Ventas confirmadas", value: formatCurrency(metrics.sales), note: "Ingresos acumulados", icon: Wallet },
    { title: "Organizadores", value: metrics.organizers.toLocaleString("es-AR"), note: `${metrics.pendingOrganizers} solicitudes pendientes`, icon: Users },
    { title: "Suscripciones", value: metrics.activeSubscriptions.toLocaleString("es-AR"), note: "Activas", icon: CreditCard },
  ]

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="overview-title" className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-primary">Resumen de plataforma</p>
            <h1 id="overview-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Panel de superadmin</h1>
            <p className="mt-2 text-muted-foreground">Una vista rápida de la actividad y la operación general.</p>
          </div>
          <Button asChild className="w-fit">
            <Link href="/superadmin/events">
              <LayoutList data-icon="inline-start" />
              Ver todos los eventos
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metricCards.map(({ title, value, note, icon: Icon }) => (
            <Card key={title}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div className="flex flex-col gap-1">
                  <CardDescription>{title}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
                </div>
                <span className="rounded-lg bg-muted p-2 text-muted-foreground">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">{note}</CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Eventos recientes</CardTitle>
              <CardDescription>Últimos eventos agregados a la plataforma.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/superadmin/events">
                Explorar eventos
                <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {events.length ? (
              <ul className="divide-y">
                {events.map((event) => (
                  <li key={event.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`/events/${event.slug || event.id}`} className="font-medium hover:underline">
                        {event.title}
                      </Link>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {formatEventDate(event.event_date)}{event.venue ? ` · ${event.venue}` : ""}
                      </p>
                    </div>
                    <Badge variant={event.status === "active" ? "default" : "secondary"} className="w-fit shrink-0">
                      {statusLabel(event.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
                <CheckCircle2 aria-hidden="true" className="size-5 text-muted-foreground" />
                <p className="font-medium">Todavía no hay eventos</p>
                <p className="text-sm text-muted-foreground">Cuando se creen, aparecerán en este resumen.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="sections-title" className="flex flex-col gap-4">
        <div>
          <h2 id="sections-title" className="text-xl font-semibold tracking-tight">Secciones internas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accesos directos a las herramientas de administración.</p>
        </div>
        <nav aria-label="Secciones de superadministración" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map(({ title, description, href, icon: Icon }) => (
            <Link key={title} href={href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <span className="rounded-lg bg-muted p-2.5 text-muted-foreground transition-colors group-hover:text-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </nav>
      </section>
    </div>
  )
}
