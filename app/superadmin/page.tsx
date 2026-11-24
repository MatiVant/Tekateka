import { redirect } from "next/navigation"
import { requireSuperadmin } from "@/lib/auth"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { SuperAdminDashboard } from "@/components/superadmin/superadmin-dashboard"
import { OrganizerManagement } from "@/components/superadmin/organizer-management"
import { MessagesInbox } from "@/components/superadmin/messages-inbox"
import { MovementsReportButton } from "@/components/admin/movements-report-button"
import { AudienceInsights } from "@/components/superadmin/audience-insights"
import { AudienceTagManager } from "@/components/superadmin/audience-tag-manager"
import { getAudienceTags } from "@/app/actions/audience-tags"
import { getSalesSummarySettings } from "@/app/actions/sales-summary-settings"
import { SuperAdminModuleCard } from "@/components/superadmin/superadmin-module-card"
import { SalesSummarySettings } from "@/components/superadmin/sales-summary-settings"
import { TicketCancellationRequests } from "@/components/superadmin/ticket-cancellation-requests"
import { PlatformFeeSettings } from "@/components/superadmin/platform-fee-settings"
import { TicketEmailRecovery } from "@/components/superadmin/ticket-email-recovery"
import { TicketSearch } from "@/components/superadmin/ticket-search"
import { MarketingCampaign } from "@/components/superadmin/marketing-campaign"
import { CalendarDays, Mail, MessageSquareText, Tags, Users, Wallet } from "lucide-react"

export default async function SuperAdminPage() {
  const { authorized, user } = await requireSuperadmin()

  if (!user) redirect("/auth/login")
  if (!authorized) redirect("/")

  const supabase = createAdminClient()

  // Primera tanda: todas las consultas independientes en paralelo
  // (antes se esperaban una detrás de otra).
  const [
    audienceTagOptions,
    salesSummarySettings,
    { data: platformSettings },
    { data: venues },
    { data: organizers },
    { data: organizerEventOwners },
    { count: eventCount },
    { count: ticketCount },
    { data: sales },
    { data: recentEvents },
    { data: insightEvents },
    { data: insightTickets },
    { data: movements },
    { data: movementTickets },
    { data: rawMessages },
    { data: rawCancellationRequests },
    { data: ticketSearchEventRows },
  ] = await Promise.all([
    getAudienceTags(),
    getSalesSummarySettings(),
    supabase.from("platform_settings").select("value").eq("key", "platform_fee_percent").maybeSingle(),
    supabase.from("venues").select("id, name, platform_fee_percent").eq("active", true).order("name"),
    supabase.from("profiles").select("*").eq("role", "organizer"),
    supabase.from("events").select("organizer_id"),
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("tickets").select("id", { count: "exact", head: true }),
    supabase.from("tickets").select("final_price").eq("payment_status", "approved"),
    supabase.from("events").select("id, title, status, event_date, venue, slug").order("created_at", { ascending: false }).limit(6),
    supabase.from("events").select("id, title, audience_tags, audience_keywords").order("event_date", { ascending: false }).limit(100),
    supabase.from("tickets").select("event_id").in("payment_status", ["approved", "confirmed"]),
    supabase
      .from("platform_movements")
      .select("id, movement_type, amount, created_at, event_id, organizer_id, ticket_id, metadata, events(title), tickets(buyer_name, buyer_email)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("tickets")
      .select("id, event_id, buyer_name, buyer_email, buyer_phone, status, payment_status, payment_provider, payment_method, payment_id, mercado_pago_reference, final_price, charged_amount, payment_fee_amount, net_amount, payment_receipt_url, payment_notes, purchased_at, paid_at, events(title)")
      .order("purchased_at", { ascending: false })
      .limit(1000),
    supabase
      .from("organizer_messages")
      .select("id, subject, body, priority, status, created_at, organizer_id")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("tickets")
      .select("id, buyer_name, buyer_email, cancellation_request_reason, cancellation_requested_at, cancellation_requested_by, events(title)")
      .eq("cancellation_request_status", "pending")
      .order("cancellation_requested_at", { ascending: true }),
    // Eventos con entradas para el filtro del buscador (más recientes primero)
    supabase
      .from("events")
      .select("id, title, event_date, tickets(count)")
      .order("event_date", { ascending: false })
      .limit(300),
  ])

  // Obtener estadísticas de organizadores
  const organizerGroupById = new Map<string, string>()
  for (const organizer of organizers || []) {
    const groupKey = organizer.organization_name?.trim().toLocaleLowerCase() || `profile:${organizer.id}`
    organizerGroupById.set(organizer.id, groupKey)
  }
  const eventCountsByGroup = new Map<string, number>()
  for (const event of organizerEventOwners || []) {
    const groupKey = organizerGroupById.get(event.organizer_id)
    if (groupKey) eventCountsByGroup.set(groupKey, (eventCountsByGroup.get(groupKey) || 0) + 1)
  }
  const organizersWithEventCounts = (organizers || []).map((organizer) => ({
    ...organizer,
    events_created_count: eventCountsByGroup.get(organizerGroupById.get(organizer.id) || `profile:${organizer.id}`) || 0,
  }))

  const pendingCount = organizers?.filter((o) => o.organizer_status === "pending").length || 0
  const activeSubscriptions = organizers?.filter((o) => o.subscription_status === "active").length || 0
  const totalSales = (sales || []).reduce((sum, ticket) => sum + Number(ticket.final_price || 0), 0)
  const buyerCounts = new Map<string, number>()
  for (const ticket of insightTickets || []) buyerCounts.set(ticket.event_id, (buyerCounts.get(ticket.event_id) || 0) + 1)
  const audienceInsights = (insightEvents || []).map((event) => {
    const tags = event.audience_tags || []
    const keywords = String(event.audience_keywords || "").toLowerCase().split(",").map((item) => item.trim()).filter(Boolean)
    const related = (insightEvents || []).filter((other) => {
      if (other.id === event.id) return false
      const otherKeywords = String(other.audience_keywords || "").toLowerCase()
      return tags.some((tag: string) => (other.audience_tags || []).includes(tag)) || keywords.some((keyword) => otherKeywords.includes(keyword))
    }).slice(0, 3).map((other) => other.title)
    return { id: event.id, title: event.title, tags, buyers: buyerCounts.get(event.id) || 0, related }
  }).filter((event) => event.tags.length > 0)

  // Segunda tanda: perfiles que dependen de la primera, también en paralelo.
  type ProfileLite = { id: string; full_name: string | null; email: string | null }
  type ProfileWithPhone = ProfileLite & { phone: string | null }
  const movementOrganizerIds = [...new Set((movements || []).map((m) => m.organizer_id as string).filter(Boolean))]
  const organizerIds = [...new Set((rawMessages || []).map((m) => m.organizer_id as string))]
  const cancellationOrganizerIds = [...new Set((rawCancellationRequests || []).map((ticket) => ticket.cancellation_requested_by).filter(Boolean))]
  const [{ data: movementOrganizers }, { data: senderProfiles }, { data: cancellationOrganizers }] = await Promise.all([
    movementOrganizerIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", movementOrganizerIds)
      : Promise.resolve({ data: [] as ProfileLite[] }),
    organizerIds.length
      ? supabase.from("profiles").select("id, full_name, email, phone").in("id", organizerIds)
      : Promise.resolve({ data: [] as ProfileWithPhone[] }),
    cancellationOrganizerIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", cancellationOrganizerIds)
      : Promise.resolve({ data: [] as ProfileLite[] }),
  ])

  const movementOrganizerMap = new Map((movementOrganizers || []).map((p) => [p.id, p]))
  const movementsWithOrganizers = (movements || []).map((movement) => ({ ...movement, organizer: movementOrganizerMap.get(movement.organizer_id as string) || null }))

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

  const cancellationOrganizerMap = new Map((cancellationOrganizers || []).map((organizer) => [organizer.id, organizer]))
  const cancellationRequests = (rawCancellationRequests || []).map((ticket) => ({
    ...ticket,
    organizer: cancellationOrganizerMap.get(ticket.cancellation_requested_by as string) || null,
  }))

  const ticketSearchEvents = (ticketSearchEventRows || [])
    .filter((event) => {
      const counts = event.tickets as unknown as { count: number }[] | null
      return Array.isArray(counts) ? (counts[0]?.count ?? 0) > 0 : true
    })
    .map((event) => ({ id: event.id as string, title: (event.title as string | null) ?? null, event_date: (event.event_date as string | null) ?? null }))

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PlatformFeeSettings globalPercent={Number((platformSettings?.value as { percent?: number } | null)?.percent ?? 8)} startsAt={(platformSettings?.value as { starts_at?: string | null } | null)?.starts_at ?? null} venues={venues ?? []} />
        <div className="mb-8"><TicketSearch events={ticketSearchEvents} /></div>
        <div className="mb-8"><TicketEmailRecovery /></div>
        <SuperAdminDashboard
          metrics={{
            events: eventCount || 0,
            tickets: ticketCount || 0,
            sales: totalSales,
            organizers: organizers?.length || 0,
            pendingOrganizers: pendingCount,
            activeSubscriptions,
          }}
          events={recentEvents || []}
        />


        <section aria-label="Herramientas de administración" className="mt-10 grid gap-4">
          <TicketCancellationRequests requests={cancellationRequests} />

          <SuperAdminModuleCard
            id="sales-summary"
            title="Resúmenes por correo"
            description="Frecuencia y envío de informes a organizadores"
            icon={Mail}
          >
            <SalesSummarySettings
              initialFrequency={salesSummarySettings.frequency}
              organizers={(organizers || []).map((organizer) => ({ id: organizer.id, full_name: organizer.full_name, email: organizer.email }))}
            />
          </SuperAdminModuleCard>

          <SuperAdminModuleCard
            id="marketing-campaign"
            title="Campañas de email"
            description="Enviar novedades a compradores con consentimiento"
            icon={Mail}
          >
            <MarketingCampaign />
          </SuperAdminModuleCard>

          <SuperAdminModuleCard
            id="movements"
            title="Movimientos"
            description="Reporte financiero y actividad de la plataforma"
            icon={Wallet}
          >
            <MovementsReportButton movements={movementsWithOrganizers} tickets={movementTickets || []} showOrganizer />
          </SuperAdminModuleCard>

          <SuperAdminModuleCard
            id="categories"
            title="Categorías"
            description="Administrar etiquetas disponibles"
            icon={Tags}
          >
            <AudienceTagManager initialTags={audienceTagOptions} />
          </SuperAdminModuleCard>

          <SuperAdminModuleCard
            id="audiences"
            title="Audiencias"
            description="Intereses y recomendaciones"
            icon={CalendarDays}
          >
            <AudienceInsights events={audienceInsights} />
          </SuperAdminModuleCard>

          <SuperAdminModuleCard
            id="messages"
            title="Mensajes"
            description="Bandeja de consultas"
            icon={MessageSquareText}
          >
            <MessagesInbox messages={messages} />
          </SuperAdminModuleCard>

          <SuperAdminModuleCard
            id="organizers"
            title="Usuarios y organizadores"
            description="Solicitudes, cuentas y suscripciones"
            icon={Users}
          >
            <OrganizerManagement organizers={organizersWithEventCounts} />
          </SuperAdminModuleCard>
        </section>
      </main>
    </div>
  )
}
