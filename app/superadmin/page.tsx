import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { SuperAdminDashboard } from "@/components/superadmin/superadmin-dashboard"
import { OrganizerManagement } from "@/components/superadmin/organizer-management"
import { MessagesInbox } from "@/components/superadmin/messages-inbox"
import { MovementsReportButton } from "@/components/admin/movements-report-button"
import { AudienceInsights } from "@/components/superadmin/audience-insights"
import { AudienceTagManager } from "@/components/superadmin/audience-tag-manager"
import { getAudienceTags } from "@/app/actions/audience-tags"

export default async function SuperAdminPage() {
  const { authorized, user, profile } = await requireAuth(["superadmin"])

  if (!authorized || !user) {
    redirect("/auth/login")
  }

  const supabase = createAdminClient()
  const audienceTagOptions = await getAudienceTags()

  // Obtener estadísticas de organizadores
  const { data: organizers } = await supabase.from("profiles").select("*").eq("role", "organizer")
  const { data: organizerEventOwners } = await supabase.from("events").select("organizer_id")
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
  const [{ count: eventCount }, { count: ticketCount }, { data: sales }, { data: recentEvents }] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("tickets").select("id", { count: "exact", head: true }),
    supabase.from("tickets").select("final_price").eq("payment_status", "approved"),
    supabase.from("events").select("id, title, status, event_date, venue, slug").order("created_at", { ascending: false }).limit(6),
  ])
  const totalSales = (sales || []).reduce((sum, ticket) => sum + Number(ticket.final_price || 0), 0)
  const [{ data: insightEvents }, { data: insightTickets }] = await Promise.all([
    supabase.from("events").select("id, title, audience_tags, audience_keywords").order("event_date", { ascending: false }).limit(100),
    supabase.from("tickets").select("event_id").in("payment_status", ["approved", "confirmed"]),
  ])
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


        <section id="movements" aria-label="Movimientos de la plataforma" className="mt-10 flex justify-end scroll-mt-24">
          <MovementsReportButton movements={movementsWithOrganizers} showOrganizer />
        </section>

        <section id="categories" className="mt-10 scroll-mt-24">
          <AudienceTagManager initialTags={audienceTagOptions} />
        </section>

        <section id="audiences" className="mt-10 scroll-mt-24">
          <AudienceInsights events={audienceInsights} />
        </section>

        <section id="messages" className="mt-10 scroll-mt-24">
          <MessagesInbox messages={messages} />
        </section>

        <section id="organizers" aria-labelledby="organizers-title" className="mt-10 scroll-mt-24">
          <div className="mb-6">
            <h2 id="organizers-title" className="text-xl font-bold">Gestión de Organizadores</h2>
            <p className="text-sm text-muted-foreground">Aprueba, rechaza o gestiona las suscripciones</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <OrganizerManagement organizers={organizersWithEventCounts} />
          </div>
        </section>
      </main>
    </div>
  )
}
