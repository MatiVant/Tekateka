"use server"

import { getCurrentUser } from "@/lib/auth"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { getOrganizerRecipients, getSummaryRange, sendOrganizerSalesSummary } from "@/lib/sales-summary"
import type { SalesSummaryFrequency, SalesSummaryPeriod } from "@/lib/sales-summary"

const defaultSettings = { frequency: "monthly" as SalesSummaryFrequency }

export async function getSalesSummarySettings() {
  const supabase = createAdminClient()
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "sales_summary").maybeSingle()
  const frequency = data?.value && typeof data.value === "object" && "frequency" in data.value ? data.value.frequency : defaultSettings.frequency
  return { frequency: frequency === "weekly" || frequency === "biweekly" || frequency === "off" ? frequency : "monthly" as SalesSummaryFrequency }
}

export async function saveSalesSummarySettings(frequency: SalesSummaryFrequency) {
  const userData = await getCurrentUser()
  if (!userData?.user || userData.profile?.role !== "superadmin") throw new Error("No autorizado")
  if (!(["monthly", "weekly", "biweekly", "off"] as string[]).includes(frequency)) throw new Error("Frecuencia inválida")
  const supabase = createAdminClient()
  const { error } = await supabase.from("platform_settings").upsert({ key: "sales_summary", value: { frequency }, updated_at: new Date().toISOString() }, { onConflict: "key" })
  if (error) throw new Error(error.message)
  return { success: true }
}

export async function sendCurrentSalesSummary(organizerId?: string, period: SalesSummaryPeriod = "now") {
  const userData = await getCurrentUser()
  if (!userData?.user || userData.profile?.role !== "superadmin") throw new Error("No autorizado")
  const organizers = await getOrganizerRecipients()
  const selected = organizerId ? organizers.filter((organizer) => organizer.id === organizerId) : organizers
  if (organizerId && selected.length === 0) throw new Error("Organizador no encontrado")
  const range = getSummaryRange(period)
  for (const organizer of selected) {
    await sendOrganizerSalesSummary(organizer, period, `sales-summary/manual/${period}/${organizer.id}/${range.start.toISOString()}`, range)
  }
  return { success: true, message: `Informe enviado a ${selected.length} organizador${selected.length === 1 ? "" : "es"}.` }
}
