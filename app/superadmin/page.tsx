import { redirect } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { Users, CheckCircle, XCircle, Clock, LayoutList } from "lucide-react"
import { OrganizerManagement } from "@/components/superadmin/organizer-management"
import { MessagesInbox } from "@/components/superadmin/messages-inbox"
import { MovementsReportButton } from "@/components/admin/movements-report-button"
import { AudienceInsights } from "@/components/superadmin/audience-insights"

export default async function SuperAdminPage() {
  const { authorized, user, profile } = await requireAuth(["superadmin"])

  if (!authorized || !user) {
    redirect("/auth/login")
  }

  const supabase = createAdminClient()

  // Obtener estadísticas de organizadores
  const { data: organizers } = await supabase.from("profiles").select("*").eq("role", "organizer")

  const pendingCount = organizers?.filter((o) => o.organizer_status === "pending").length || 0
  const approvedCount = organizers?.filter((o) => o.organizer_status === "approved").length || 0
  const rejectedCount = organizers?.filter((o) => o.organizer_status === "rejected").length || 0
  const activeSubscriptions = organizers?.filter((o) => o.subscription_status === "active").length || 0
  const [{ count: eventCount }, { count: ticketCount }, { data: sales }] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("tickets").select("id", { count: "exact", head: true }),
    supabase.from("tickets").select("final_price").eq("payment_status", "approved"),
  ])
  const totalSales = (sales || []).reduce((sum, ticket) => sum + Number(ticket.final_price || 0), 0)
  const [{ data: insightEvents }, { data: insightTickets }] = await Promise.all([
    supabase.from("events").select("id, title, audience_tags").order("event_date", { ascending: false }).limit(100),
    supabase.from("tickets").select("event_id").in("payment_status", ["approved", "confirmed"]),
  ])
  const buyerCounts = new Map<string, number>()
  for (const ticket of insightTickets || []) buyerCounts.set(ticket.event_id, (buyerCounts.get(ticket.event_id) || 0) + 1)
  const audienceInsights = (insightEvents || []).map((event) => {
    const tags = event.audience_tags || []
    const related = (insightEvents || []).filter((other) => other.id !== event.id && tags.some((tag: string) => (other.audience_tags || []).includes(tag))).slice(0, 3).map((other) => other.title)
    return { id: event.id, title: event.title, tags, buyers: buyerCounts.get(event.id) || 0, related }
  }).filter((event) => event.tags.length > 0)
  const { data: movements } = await supabase
    .from("platform_movements")
    .select("id, movement_type, amount, created_at, event_id, organizer_id, ticket_id, metadata, events(title), tickets(buyer_name, buyer_email)")
    .order("created_at", { ascending: false })
    .limit(100)

  const movementOrganizerIds = [...new Set((movements || []).map((m) => m.organizer_id as string).filter(Boolean))]
  const { data: movementOrganizers } = movementOrganizerIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", movementOrganizerIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
  const movementOrganizerMap = new Map((movementOrganizers || []).map((p) => [p.id, p]))
  const movementsWithOrganizers = (movements || []).map((movement) => ({ ...movement, organizer: movementOrganizerMap.get(movement.organizer_id as string) || null }))

  const { data: rawMessages } = await supabase
    .from("organizer_messages")
    .select("id, subject, body, priority, status, created_at, organizer_id")
    .order("created_at", { ascending: false })
    .limit(100)

  const organizerIds = [...new Set((rawMessages || []).map((m) => m.organizer_id as string))]
  const { data: senderProfiles } = organizerIds.length
    ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", organizerIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null; phone: string | null }[] }
  const profileMap = new Map((senderProfiles || []).map((p) => [p.id, p]))

  const messages = (rawMessages || []).map((m) => {
    const p = profileMap.get(m.organizer_id as string)
    return {
      id: m.id as string,
      subject: m.subject as string,
      body: m.body as string,
      priority: m.priority as "low" | "normal" | "high",
      status: m.status as "unread" | "read" | "resolved",
      created_at: m.created_at as string,
      organizer_name: p?.full_name ?? null,
      organizer_email: p?.email ?? null,
      organizer_phone: p?.phone ?? null,
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Administración</h1>
            <p className="text-muted-foreground">Gestiona organizadores, suscripciones y plataforma</p>
          </div>
          <Button asChild className="w-fit">
            <Link href="/superadmin/events">
              <LayoutList className="mr-2 h-4 w-4" />
              Todos los eventos
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <div className="group p-6 bg-card border border-border rounded-lg hover:border-yellow-500/30 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Pendientes</span>
              <Clock className="h-5 w-5 text-yellow-500/60 group-hover:text-yellow-500 transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-2">Esperando aprobación</p>
          </div>

          <div className="group p-6 bg-card border border-border rounded-lg hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Aprobados</span>
              <CheckCircle className="h-5 w-5 text-emerald-500/60 group-hover:text-emerald-500 transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{approvedCount}</div>
            <p className="text-xs text-muted-foreground mt-2">Organizadores activos</p>
          </div>

          <div className="group p-6 bg-card border border-border rounded-lg hover:border-red-500/30 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Rechazados</span>
              <XCircle className="h-5 w-5 text-red-500/60 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{rejectedCount}</div>
            <p className="text-xs text-muted-foreground mt-2">Solicitudes rechazadas</p>
          </div>

          <div className="group p-6 bg-card border border-border rounded-lg hover:border-primary/30 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Suscripciones</span>
              <Users className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground mt-2">Con suscripción activa</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">Eventos publicados</p>
            <p className="mt-2 text-3xl font-bold">{eventCount || 0}</p>
          </div>
          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">Entradas emitidas</p>
            <p className="mt-2 text-3xl font-bold">{ticketCount || 0}</p>
          </div>
          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">Ventas confirmadas</p>
            <p className="mt-2 text-3xl font-bold">${totalSales.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <section className="mb-12 flex justify-end">
          <MovementsReportButton movements={movementsWithOrganizers} showOrganizer />
        </section>

        <AudienceInsights events={audienceInsights} />

        <section className="mb-12">
          <MessagesInbox messages={messages} />
        </section>

        {/* Organizers Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold">Gestión de Organizadores</h2>
            <p className="text-sm text-muted-foreground">Aprueba, rechaza o gestiona las suscripciones</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <OrganizerManagement organizers={organizers || []} />
          </div>
        </div>
      </main>
    </div>
  )
}
