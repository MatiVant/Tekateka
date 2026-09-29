import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MovementsReportButton } from "@/components/admin/movements-report-button"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { Calendar, Ticket, DollarSign, Users, Plus, Clock, XCircle } from "lucide-react"
import Link from "next/link"
import { EventsList } from "@/components/admin/events-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MercadoPagoConnect } from "@/components/admin/mercadopago-connect"
import { ContactSuperadmin } from "@/components/admin/contact-superadmin"
import { PendingOwnershipTransfers } from "@/components/admin/pending-ownership-transfers"
import { getPendingTransfers } from "@/app/actions/event-ownership-transfer"
// import { archivePastEvents } from "@/app/actions/archive-event"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

export default async function AdminPage() {
  const { authorized, user, profile } = await requireAuth(["organizer", "superadmin"])

  if (!authorized || !user) {
    redirect("/auth/login")
  }

  const supabase = await createClient()
  const adminSupabase = createAdminClient()
  const pendingTransfers = await getPendingTransfers()
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

  const { data: externalPayments } = await adminSupabase
    .from("external_payment_notifications")
    .select("payment_id, amount, currency, payer_email, payment_date, raw_status, created_at")
    .eq("producer_id", user.id)
    .eq("status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(20)

  const { data: allOrganizerEvents } = await adminSupabase
    .from("events")
    .select("id, title, status")
    .eq("organizer_id", user.id)
  const organizerEventIds = (allOrganizerEvents || []).map((event) => event.id)

  const { data: movements } = organizerEventIds.length
    ? await adminSupabase
        .from("platform_movements")
        .select("id, movement_type, amount, created_at, event_id, ticket_id, metadata, events(title, organizer_id), tickets(buyer_name, buyer_email)")
        .in("event_id", organizerEventIds)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] }

  const totalEvents = events?.length || 0
  const totalTickets = tickets?.length || 0
  const confirmedTickets = tickets?.filter((t) => t.payment_status === "approved" || t.status === "confirmed").length || 0
  const pendingTickets = tickets?.filter((t) => t.payment_status !== "approved" && t.status === "pending").length || 0
  const totalRevenue =
    tickets
      ?.filter((t) => t.payment_status === "approved" || t.status === "confirmed")
      .reduce((sum, ticket: any) => sum + Number(ticket.net_amount ?? ticket.final_price ?? ticket.events.price ?? 0), 0) || 0
  const eventReports = (allOrganizerEvents || []).map((event: any) => {
    const eventTickets = (tickets || []).filter((ticket: any) => ticket.event_id === event.id && (ticket.payment_status === "approved" || ticket.status === "confirmed"))
    const eventPendingTickets = (tickets || []).filter((ticket: any) => ticket.event_id === event.id && ticket.payment_status !== "approved" && ticket.status === "pending")
    return {
      event,
      count: eventTickets.length,
      pendingCount: eventPendingTickets.length,
      gross: eventTickets.reduce((sum: number, ticket: any) => sum + Number(ticket.charged_amount ?? ticket.final_price ?? 0), 0),
      fees: eventTickets.reduce((sum: number, ticket: any) => sum + Number(ticket.payment_fee_amount ?? 0), 0),
      net: eventTickets.reduce((sum: number, ticket: any) => sum + Number(ticket.net_amount ?? ticket.final_price ?? 0), 0),
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PendingOwnershipTransfers transfers={pendingTransfers} />
        {/* Header */}
        <div className="mb-12">
          <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <MercadoPagoConnect connected={Boolean(mercadoPagoConnection)} isSuperadmin={profile?.role === "superadmin"} />
            {profile?.role === "superadmin" && <div className="rounded-lg border border-primary/20 bg-card px-4 py-3"><p className="text-sm"><span className="font-medium text-primary">Superadmin</span><br /><span className="text-muted-foreground">Eventos ilimitados</span></p></div>}
          </div>

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

        </div>

        {/* Events Section */}
        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-bold">Listado de Eventos</h2>
            <p className="text-sm text-muted-foreground">Revisa el estado y desempeño de tus eventos</p>
          </div>
          <Tabs defaultValue="active" className="w-full">
            <div className="flex items-center justify-between mb-6"><TabsList className="grid w-fit grid-cols-2"><TabsTrigger value="active">Activos</TabsTrigger><TabsTrigger value="archived">Finalizados</TabsTrigger></TabsList></div>
            <TabsContent value="active"><EventsList userId={user.id} showArchived={false} /></TabsContent>
            <TabsContent value="archived"><EventsList userId={user.id} showArchived={true} /></TabsContent>
          </Tabs>
        </section>

        {profile?.role !== "superadmin" && !profile?.subscription_active && <div className="mb-8 rounded-lg border border-border bg-card p-4"><p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Plan Gratis:</span> {1 - (profile?.events_created || 0)} evento disponible</p></div>}
        {profile?.subscription_active && profile?.role !== "superadmin" && <div className="mb-8 rounded-lg border border-primary/20 bg-card p-4"><p className="text-sm"><span className="font-medium text-primary">Suscripción Activa</span> - Eventos ilimitados</p></div>}

        {/* Resumen compacto */}
        <section className="mb-3">
          <h2 className="text-xl font-bold">Total histórico</h2>
          <p className="text-sm text-muted-foreground">Resumen acumulado de todos tus eventos.</p>
        </section>
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Eventos Activos</span>
              <Calendar className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalEvents}</div>
          </div>

          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Entradas Vendidas</span>
              <Ticket className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalTickets}</div>
            <p className="text-xs text-muted-foreground mt-2">{confirmedTickets} confirmadas</p>
          </div>

          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Ingresos Confirmados</span>
              <DollarSign className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">${totalRevenue.toFixed(2)}</div>
          </div>

          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Pendientes</span>
              <Users className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-3xl font-bold text-foreground">{pendingTickets}</div>
            <Button asChild variant="link" className="px-0 h-auto mt-2 text-xs">
              <Link href="/admin/tickets">Revisar</Link>
            </Button>
          </div>
        </div>

        <section className="mb-12">
          <div className="mb-6"><h2 className="text-xl font-bold">Total histórico por evento</h2><p className="text-sm text-muted-foreground">Entradas confirmadas y pendientes de confirmación, total cobrado, cargos de Mercado Pago y neto.</p></div>
          <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-left">Evento</th><th className="p-3 text-right">Confirmadas</th><th className="p-3 text-right">Pendientes</th><th className="p-3 text-right">Cobrado</th><th className="p-3 text-right">Cargos</th><th className="p-3 text-right">Neto</th></tr></thead><tbody>{eventReports.map(({ event, count, pendingCount, gross, fees, net }) => <tr key={event.id} className="border-t"><td className="p-3 font-medium">{event.title}</td><td className="p-3 text-right">{count}</td><td className="p-3 text-right">{pendingCount > 0 ? <span className="text-amber-600 dark:text-amber-500 font-medium">{pendingCount}</span> : pendingCount}</td><td className="p-3 text-right">{formatCurrency(gross)}</td><td className="p-3 text-right">{formatCurrency(fees)}</td><td className="p-3 text-right font-semibold">{formatCurrency(net)}</td></tr>)}{eventReports.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Todavía no hay ventas.</td></tr>}</tbody></table></div>
        </section>

        {externalPayments && externalPayments.length > 0 && (
          <section className="mb-12 rounded-lg border border-amber-500/40 bg-amber-500/5 p-6" aria-labelledby="external-payments-title">
            <h2 id="external-payments-title" className="text-xl font-bold">Pagos por link externo para revisar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Mercado Pago informó estos pagos, pero no están vinculados automáticamente a una entrada.</p>
            <div className="mt-4 space-y-3">
              {externalPayments.map((payment) => (
                <div key={payment.payment_id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4 text-sm">
                  <div>
                    <p className="font-medium">Pago #{payment.payment_id}</p>
                    <p className="text-muted-foreground">Pagador: {payment.payer_email || "No informado"} · Estado: {payment.raw_status === "approved" ? "Pago aprobado" : payment.raw_status === "pending" ? "Pago pendiente" : payment.raw_status === "rejected" ? "Pago rechazado" : payment.raw_status || "No informado"}</p>
                  </div>
                  <p className="font-semibold">{payment.amount ?? "—"} {payment.currency || ""}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-12 flex justify-end">
          <MovementsReportButton movements={movements || []} />
        </section>



        {profile?.role !== "superadmin" && (
          <div className="mt-12">
            <ContactSuperadmin />
          </div>
        )}
      </main>
    </div>
  )
}
