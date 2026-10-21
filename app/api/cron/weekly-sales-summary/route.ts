import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { getOrganizerRecipients, getScheduledSummaryRange, sendOrganizerSalesSummary } from "@/lib/sales-summary"
import type { SalesSummaryFrequency } from "@/lib/sales-summary"

export const dynamic = "force-dynamic"

function argentinaDayOfMonth(date: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric" }).format(date))
}

function argentinaWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short" }).format(date)
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "Email is not configured" }, { status: 503 })

  const supabase = createAdminClient()
  const { data: setting } = await supabase.from("platform_settings").select("value").eq("key", "sales_summary").maybeSingle()
  const rawFrequency = setting?.value && typeof setting.value === "object" && "frequency" in setting.value ? setting.value.frequency : "monthly"
  const frequency: SalesSummaryFrequency = rawFrequency === "weekly" || rawFrequency === "off" ? rawFrequency : "monthly"
  const now = new Date()

  if (frequency === "off") return Response.json({ success: true, sent: 0, skipped: true, reason: "disabled" })
  if (frequency === "monthly" && argentinaDayOfMonth(now) !== 1) return Response.json({ success: true, sent: 0, skipped: true, reason: "monthly_schedule" })
  if (frequency === "weekly" && argentinaWeekday(now) !== "Mon") return Response.json({ success: true, sent: 0, skipped: true, reason: "weekly_schedule" })

  const organizers = await getOrganizerRecipients()
  const range = getScheduledSummaryRange(frequency, now)
  let sent = 0
  for (const organizer of organizers) {
    try {
      await sendOrganizerSalesSummary(organizer, frequency === "weekly" ? "week" : "month", `sales-summary/${frequency}/${organizer.id}/${range.start.toISOString()}`, range)
      sent += 1
    } catch (error) {
      console.error(`[sales-summary] No se pudo enviar a ${organizer.email}`, error)
    }
  }

  return Response.json({ success: true, sent, frequency, period: range.label })
}

export { GET as POST }
