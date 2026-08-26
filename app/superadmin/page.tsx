import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { Users, CheckCircle, XCircle, Clock } from "lucide-react"
import { OrganizerManagement } from "@/components/superadmin/organizer-management"

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
  const { data: movements } = await supabase
    .from("platform_movements")
    .select("id, movement_type, amount, created_at, event_id, organizer_id, events(title)")
    .order("created_at", { ascending: false })
    .limit(8)

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Administración</h1>
          <p className="text-muted-foreground">Gestiona organizadores, suscripciones y plataforma</p>
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

        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-bold">Últimos movimientos</h2>
            <p className="text-sm text-muted-foreground">Actividad global de tickets y pagos</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="p-4 text-left">Evento</th><th className="p-4 text-left">Movimiento</th><th className="p-4 text-left">Importe</th><th className="p-4 text-left">Fecha</th></tr></thead>
              <tbody>
                {(movements || []).map((movement) => {
                  const event = Array.isArray(movement.events) ? movement.events[0] : movement.events
                  return <tr key={movement.id} className="border-t border-border"><td className="p-4">{event?.title || "Evento eliminado"}</td><td className="p-4">{movement.movement_type}</td><td className="p-4">{Number(movement.amount || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</td><td className="p-4 text-muted-foreground">{new Date(movement.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</td></tr>
                })}
              </tbody>
            </table>
          </div>
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
