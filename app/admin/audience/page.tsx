'use server'

import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { AudienceReport } from "@/components/admin/audience-report"

export type AudienceReportRow = {
  email: string
  name: string
  phone: string
  marketingConsent: boolean
  ticketCount: number
  lastPurchase: string | null
  events: string[]
  tags: string[]
}

export type AudienceAnticipationMetric = {
  label: string
  tickets: number
  averageDays: number
  medianDays: number
}

type TicketRecord = {
  buyer_name: string | null
  buyer_email: string
  buyer_phone: string | null
  marketing_consent: boolean | null
  purchased_at: string | null
  status: string
  payment_status: string | null
  events: {
    title: string
    venue: string | null
    event_date: string
    audience_tags: string[] | null
    audience_keywords: string | null
  } | null
}

export default async function AudiencePage() {
  const { authorized, user, profile } = await requireAuth(["superadmin"])
  if (!authorized || !user) redirect("/auth/login")
  if (profile?.role !== "superadmin") redirect("/admin")

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("tickets")
    .select("buyer_name, buyer_email, buyer_phone, marketing_consent, purchased_at, status, payment_status, events!inner(title, venue, event_date, audience_tags, audience_keywords, organizer_id)")
    .order("purchased_at", { ascending: false })

  const buyers = new Map<string, AudienceReportRow>()
  const anticipationByEvent = new Map<string, number[]>()
  const anticipationByVenue = new Map<string, number[]>()
  for (const raw of (data ?? []) as unknown as TicketRecord[]) {
    const isConfirmed = raw.status === "confirmed" || raw.status === "used" || raw.payment_status === "approved"
    if (raw.status === "cancelled" || !isConfirmed) continue

    const email = raw.buyer_email.trim().toLowerCase()
    if (!email) continue
    const event = raw.events
    if (event?.event_date && raw.purchased_at) {
      const anticipationDays = Math.max(0, (new Date(event.event_date).getTime() - new Date(raw.purchased_at).getTime()) / 86_400_000)
      if (event.title) anticipationByEvent.set(event.title, [...(anticipationByEvent.get(event.title) ?? []), anticipationDays])
      const venue = event.venue?.trim() || "Sin espacio informado"
      anticipationByVenue.set(venue, [...(anticipationByVenue.get(venue) ?? []), anticipationDays])
    }
    const tags = [
      ...(event?.audience_tags ?? []),
      ...(event?.audience_keywords ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    ]
    const current = buyers.get(email) ?? {
      email,
      name: raw.buyer_name?.trim() || "",
      phone: raw.buyer_phone?.trim() || "",
      marketingConsent: false,
      ticketCount: 0,
      lastPurchase: null,
      events: [],
      tags: [],
    }

    current.name ||= raw.buyer_name?.trim() || ""
    current.phone ||= raw.buyer_phone?.trim() || ""
    current.marketingConsent ||= raw.marketing_consent === true
    current.ticketCount += 1
    if (event?.title && !current.events.includes(event.title)) current.events.push(event.title)
    for (const tag of tags) {
      if (!current.tags.includes(tag)) current.tags.push(tag)
    }
    if (!current.lastPurchase || new Date(raw.purchased_at ?? 0) > new Date(current.lastPurchase)) {
      current.lastPurchase = raw.purchased_at
    }
    buyers.set(email, current)
  }

  const rows = Array.from(buyers.values()).sort((a, b) =>
    new Date(b.lastPurchase ?? 0).getTime() - new Date(a.lastPurchase ?? 0).getTime(),
  )

  const buildMetrics = (source: Map<string, number[]>): AudienceAnticipationMetric[] => Array.from(source.entries())
    .map(([label, values]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const middle = Math.floor(sorted.length / 2)
      const medianDays = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
      return {
        label,
        tickets: values.length,
        averageDays: values.reduce((sum, value) => sum + value, 0) / values.length,
        medianDays,
      }
    })
    .sort((a, b) => b.tickets - a.tickets || a.label.localeCompare(b.label))

  return <AudienceReport rows={rows} eventMetrics={buildMetrics(anticipationByEvent)} venueMetrics={buildMetrics(anticipationByVenue)} />
}
