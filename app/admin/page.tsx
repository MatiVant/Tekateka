import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { Calendar, Ticket, DollarSign, Users, Plus, Clock, XCircle } from "lucide-react"
import Link from "next/link"
import { EventsList } from "@/components/admin/events-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MercadoPagoConnect } from "@/components/admin/mercadopago-connect"
// import { archivePastEvents } from "@/app/actions/archive-event"

export default async function AdminPage() {
  const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])

  if (!authorized || !user) {
    redirect("/auth/login")
  }

  const supabase = await createClient()
  const adminSupabase = createAdminClient()
  const { data: mercadoPagoConnection } = await adminSupabase.from("mercadopago_connections").select("id").eq("producer_id", user.id).maybeSingle()

  // El trigger de la BD actualiza automáticamente el estado

  if (profile?.role !== "superadmin") {
    if (profile?.organizer_status === "pending") {
      return (
        <div className="min-h-screen bg-muted/30">
          <main className="container mx-auto px-4 py-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 mx-auto">
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Cuenta Pendiente de Aprobación</h1>
              <p className="text-muted-foreground mb-4">
                Tu cuenta de organizador está siendo revisada por un administrador. Recibirás un email cuando sea
                aprobada.
              </p>
              <Button asChild variant="outline">
                <Link href="/">Volver al inicio</Link>
              </Button>
            </div>
          </main>
        </div>
      )
    }

    if (profile?.organizer_status === "rejected") {
      return (
        <div className="min-h-screen bg-muted/30">
          <main className="container mx-auto px-4 py-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Solicitud Rechazada</h1>
              <p className="text-muted-foreground mb-4">Tu solicitud para ser organizador ha sido rechazada.</p>
              {profile.rejection_reason && (
                <div className="p-4 bg-muted rounded-lg text-sm text-left mb-4">
                  <p className="font-semibold mb-1">Motivo:</p>
                  <p className="text-muted-foreground">{profile.rejection_reason}</p>
                </div>
              )}
              <Button asChild variant="outline">
                <Link href="/">Volver al inicio</Link>
              </Button>
            </div>
          </main>
        </div>
      )
    }
  }

  const canCreateEvent =
    profile?.role === "superadmin" || profile?.subscription_active === true || (profile?.events_created || 0) < 1

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", user.id)
    .in("status", ["active", "inactive", "sold_out"])

  const { data: tickets } = await supabase
    .from("tickets")
    .select("*, events!inner(*)")
    .eq("events.organizer_id", user.id)

  const totalEvents = events?.length || 0
  const totalTickets = tickets?.length || 0
  const confirmedTickets = tickets?.filter((t) => t.payment_status === "approved" || t.status === "confirmed").length || 0
  const pendingTickets = tickets?.filter((t) => t.payment_status !== "approved" && t.status === "pending").length || 0
  const totalRevenue =
    tickets
      ?.filter((t) => t.payment_status === "approved" || t.status === "confirmed")
      .reduce((sum, ticket: any) => sum + Number(ticket.final_price ?? ticket.events.price ?? 0), 0) || 0

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          {profile?.role !== "superadmin" && <MercadoPagoConnect connected={Boolean(mercadoPagoConnection)} />}

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Mis Eventos</h1>
              <p className="text-muted-foreground">Gestiona y monitorea tus eventos en vivo</p>
            </div>
            {canCreateEvent ? (
              <Button asChild size="lg" className="gap-2">
                <Link href="/admin/events/new">
                  <Plus className="h-5 w-5" />
                  Crear Evento
                </Link>
              </Button>
            ) : (
              <Button size="lg" disabled className="gap-2">
                <Plus className="h-5 w-5" />
                Límite Alcanzado
              </Button>
            )}
          </div>

          {/* Status banner */}
          {profile?.role !== "superadmin" && !profile?.subscription_active && (
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Plan Gratis:</span> {1 - (profile?.events_created || 0)} evento disponible
              </p>
            </div>
          )}
          {profile?.role === "superadmin" && (
            <div className="p-4 bg-card border border-primary/20 rounded-lg">
              <p className="text-sm"><span className="font-medium text-primary">Superadmin</span> - Eventos ilimitados</p>
            </div>
          )}
          {profile?.subscription_active && profile?.role !== "superadmin" && (
            <div className="p-4 bg-card border border-primary/20 rounded-lg">
              <p className="text-sm"><span className="font-medium text-primary">Suscripción Activa</span> - Eventos ilimitados</p>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <div className="group p-6 bg-card border border-border rounded-lg hover:border-primary/30 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Eventos Activos</span>
              <Calendar className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalEvents}</div>
          </div>

          <div className="group p-6 bg-card border border-border rounded-lg hover:border-primary/30 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Entradas Vendidas</span>
              <Ticket className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalTickets}</div>
            <p className="text-xs text-muted-foreground mt-2">{confirmedTickets} confirmadas</p>
          </div>

          <div className="group p-6 bg-card border border-border rounded-lg hover:border-primary/30 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Ingresos Confirmados</span>
              <DollarSign className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">${totalRevenue.toFixed(2)}</div>
          </div>

          <div className="group p-6 bg-card border border-border rounded-lg hover:border-primary/30 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Pendientes</span>
              <Users className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{pendingTickets}</div>
            <Button asChild variant="link" className="px-0 h-auto mt-2 text-xs">
              <Link href="/admin/tickets">Revisar</Link>
            </Button>
          </div>
        </div>

        {/* Events Section */}
        <div>
          <Tabs defaultValue="active" className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Listado de Eventos</h2>
                <p className="text-sm text-muted-foreground">Revisa el estado y desempeño de tus eventos</p>
              </div>
              <TabsList className="grid w-fit grid-cols-2">
                <TabsTrigger value="active">Activos</TabsTrigger>
                <TabsTrigger value="archived">Finalizados</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="active">
              <EventsList userId={user.id} showArchived={false} />
            </TabsContent>
            <TabsContent value="archived">
              <EventsList userId={user.id} showArchived={true} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
