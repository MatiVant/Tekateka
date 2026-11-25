import { cache } from "react"
import { notFound, redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export type ManagedEvent = {
  id: string
  title: string
  event_date: string
  slug: string | null
  organizer_id: string
}

// cache(): el layout y las páginas del evento reutilizan la misma consulta liviana.
export const getManagedEvent = cache(async function getManagedEvent(eventId: string) {
  const { authorized, user, profile } = await requireAuth(["organizer"])
  if (!authorized || !user) {
    redirect("/auth/login")
  }

  const supabase = await createClient()
  let eventQuery = supabase
    .from("events")
    .select("id, title, event_date, slug, organizer_id")
    .eq("id", eventId)

  if (profile?.role !== "superadmin") {
    eventQuery = eventQuery.eq("organizer_id", user.id)
  }

  const { data: event } = await eventQuery.maybeSingle()
  if (!event) {
    notFound()
  }

  return { event: event as ManagedEvent, user, profile }
})
