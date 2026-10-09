import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { MovementsReportButton } from "@/components/admin/movements-report-button"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { Calendar, Ticket, DollarSign, Plus, Clock, XCircle, Banknote, CreditCard, DoorOpen } from "lucide-react"
import Link from "next/link"
import { EventsList } from "@/components/admin/events-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MercadoPagoConnect } from "@/components/admin/mercadopago-connect"
import { ContactSuperadmin } from "@/components/admin/contact-superadmin"
import { PendingOwnershipTransfers } from "@/components/admin/pending-ownership-transfers"
import { WeeklySalesSummaryButton } from "@/components/admin/weekly-sales-summary-button"
import { getPendingTransfers } from "@/app/actions/event-ownership-transfer"
// import { archivePastEvents } from "@/app/actions/archive-event"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

type AdminTicketSummary = {
  id: string
  event_id: string
  status: string | null
  payment_status: string | null
  payment_method: string | null
  payment_provider: string | null
  charged_amount: number | string | null
  final_price: number | string | null
  net_amount: number | string | null
  payment_fee_amount: number | string | null
  payment_receipt_url: string | null
  purchased_at: string | null
  buyer_name: string
  events: { price: number | string | null; title: string } | null
}

type OrganizerEventSummary = { id: string; title: string; status: string | null }
type EventSettlementSummary = { door_paid_count: number | null; door_paid_unit_price: number | string | null }
type DoorSaleSummary = { event_id: string; quantity: number; unit_price: number | string }

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
    .order("purchased_at", { ascending: false })

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

  const { data: settlements } = organizerEventIds.length
    ? await adminSupabase
        .from("event_settlements")
        .select("event_id, door_paid_count, door_paid_unit_price")
        .in("event_id", organizerEventIds)
    : { data: [] }
  const { data: doorSales } = organizerEventIds.length
    ? await adminSupabase.from("door_sales").select("event_id, quantity, unit_price").in("event_id", organizerEventIds)
    : { data: [] }

  const ticketRecords = (tickets || []) as AdminTicketSummary[]
  const eventRecords = (allOrganizerEvents || []) as OrganizerEventSummary[]
  const settlementRecords = (settlements || []) as EventSettlementSummary[]
  const doorSaleRecords = (doorSales || []) as DoorSaleSummary[]
  const totalEvents = events?.length || 0
  const recentPurchases = ticketRecords
    .filter((ticket) => ticket.status !== "cancelled")
    .sort((a, b) => new Date(b.purchased_at ?? 0).getTime() - new Date(a.purchased_at ?? 0).getTime())
  const recentPurchasePreview = recentPurchases.slice(0, 6)
  const soldTickets = ticketRecords.filter((ticket) =>
    ticket.status !== "cancelled" &&
    (ticket.status === "confirmed" || ticket.status === "used" || ticket.payment_status === "approved" || Boolean(ticket.payment_receipt_url)),
  )
  const pendingTickets = ticketRecords.filter(
    (ticket) => ticket.status === "pending" && ticket.payment_status !== "approved",
  ).length
  const ticketCharge = (ticket: AdminTicketSummary) => Number(ticket.charged_amount ?? ticket.final_price ?? ticket.events?.price ?? 0)
  const transferRevenue = soldTickets
    .filter((ticket) => ticket.payment_method === "transfer")
    .reduce((sum, ticket) => sum + ticketCharge(ticket), 0)
  const mercadoPagoRevenue = soldTickets
    .filter((ticket) => ticket.payment_method === "mercado_pago" || ticket.payment_method === "external_link" || ["mercado_pago", "mercadopago"].includes(ticket.payment_provider ?? ""))
    .reduce((sum, ticket) => sum + ticketCharge(ticket), 0)
  const legacyDoorRevenue = settlementRecords.reduce((sum, settlement) => sum + Number(settlement.door_paid_count ?? 0) * Number(settlement.door_paid_unit_price ?? 0), 0)
  const doorRevenue = doorSaleRecords.reduce((sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price), 0) || legacyDoorRevenue
  const doorTicketCount = doorSaleRecords.reduce((sum, sale) => sum + Number(sale.quantity), 0) || settlementRecords.reduce((sum, settlement) => sum + Number(settlement.door_paid_count ?? 0), 0)
  const totalRevenue = soldTickets.reduce((sum, ticket) => sum + ticketCharge(ticket), 0) + doorRevenue
  const totalSoldCount = soldTickets.length + doorTicketCount
  const eventReports = eventRecords.map((event) => {
    const eventTickets = soldTickets.filter((ticket) => ticket.event_id === event.id)
    return {
      event,
      count: eventTickets.length + doorSaleRecords.filter((sale) => sale.event_id === event.id).reduce((sum, sale) => sum + Number(sale.quantity), 0),
      gross: eventTickets.reduce((sum, ticket) => sum + ticketCharge(ticket), 0) + doorSaleRecords.filter((sale) => sale.event_id === event.id).reduce((sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price), 0),
      fees: eventTickets.reduce((sum, ticket) => sum + Number(ticket.payment_fee_amount ?? 0), 0),
      net: eventTickets.reduce((sum, ticket) => sum + Number(ticket.net_amount ?? ticket.final_price ?? 0), 0),
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
        <section className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Resumen de ventas</h2>
            <p className="text-sm text-muted-foreground">Incluye pagos aprobados y comprobantes cargados; excluye entradas canceladas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/tickets">Ver listas de entradas</Link>
            </Button>
            {profile?.role === "organizer" && <WeeklySalesSummaryButton />}
          </div>
        </section>
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-medium text-muted-foreground">Eventos activos</span><Calendar aria-hidden="true" className="h-5 w-5 shrink-0 text-primary/60" /></div>
            <div className="text-3xl font-bold text-foreground">{totalEvents}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-medium text-muted-foreground">Entradas vendidas</span><Ticket aria-hidden="true" className="h-5 w-5 shrink-0 text-primary/60" /></div>
            <div className="text-3xl font-bold text-foreground">{totalSoldCount}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-medium text-muted-foreground">Entradas pendientes</span><Clock aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-600" /></div>
            <div className="text-3xl font-bold text-foreground">{pendingTickets}</div>
            <Button asChild variant="link" className="mt-2 h-auto px-0 text-xs"><Link href="/admin/tickets?view=pending">Revisar pendientes</Link></Button>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-medium text-muted-foreground">Transferencias informadas</span><Banknote aria-hidden="true" className="h-5 w-5 shrink-0 text-primary/60" /></div>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(transferRevenue)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-medium text-muted-foreground">Dinero por Mercado Pago</span><CreditCard aria-hidden="true" className="h-5 w-5 shrink-0 text-primary/60" /></div>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(mercadoPagoRevenue)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-medium text-muted-foreground">Dinero en puerta</span><DoorOpen aria-hidden="true" className="h-5 w-5 shrink-0 text-primary/60" /></div>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(doorRevenue)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-medium text-muted-foreground">Total vendido</span><DollarSign aria-hidden="true" className="h-5 w-5 shrink-0 text-primary/60" /></div>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</div>
          </div>
        </div>

        <section className="mb-12" aria-labelledby="recent-purchases-title">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="recent-purchases-title" className="text-xl font-bold">Entradas nuevas</h2>
              <p className="text-sm text-muted-foreground">Las compras más recientes de tus eventos. No enviamos avisos por cada compra.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{recentPurchasePreview.length} mostradas</span>
          </div>
          <div className="divide-y rounded-lg border bg-card">
            {recentPurchasePreview.length ? recentPurchasePreview.map((ticket) => (
              <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{ticket.buyer_name} · {ticket.events?.title || "Evento"}</p>
                  <p className="text-muted-foreground">{ticket.purchased_at ? new Date(ticket.purchased_at).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }) : "Fecha no disponible"}</p>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-xs">{ticket.status === "used" ? "Usada" : ticket.status === "confirmed" || ticket.payment_status === "approved" ? "Confirmada" : "Pendiente"}</span>
              </div>
            )) : <p className="p-6 text-center text-sm text-muted-foreground">Todavía no hay compras nuevas.</p>}
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-bold">Ventas por evento</h2>
            <p className="text-sm text-muted-foreground">Cuenta pagos aprobados o con comprobante cargado. Las pendientes y canceladas se consultan en sus listas.</p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left">Evento</th>
                  <th className="p-3 text-right">Vendidas</th>
                  <th className="p-3 text-right">Total vendido</th>
                  <th className="p-3 text-right">Cargos</th>
                  <th className="p-3 text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {eventReports.map(({ event, count, gross, fees, net }) => (
                  <tr key={event.id} className="border-t">
                    <td className="p-3 font-medium">{event.title}</td>
                    <td className="p-3 text-right">{count}</td>
                    <td className="p-3 text-right">{formatCurrency(gross)}</td>
                    <td className="p-3 text-right">{formatCurrency(fees)}</td>
                    <td className="p-3 text-right font-semibold">{formatCurrency(net)}</td>
                  </tr>
                ))}
                {eventReports.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Todavía no hay ventas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
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
