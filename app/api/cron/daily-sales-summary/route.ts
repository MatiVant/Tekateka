import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { redactForLog } from "@/lib/mask-personal-data"
import { getArgentinaDayRange, getOrganizerRecipients, getPreviousArgentinaDayRange, sendOrganizerSalesSummary } from "@/lib/sales-summary"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: "El envío de correo no está configurado." }, { status: 503 })
  }

  const requestedDay = new URL(request.url).searchParams.get("day")
  const range = requestedDay ? getArgentinaDayRange(requestedDay) : getPreviousArgentinaDayRange()
  if (!range) return Response.json({ error: "El día tiene que tener formato AAAA-MM-DD." }, { status: 400 })

  const supabase = createAdminClient()
  const { error: cleanupError } = await supabase.rpc("cleanup_rate_limit_requests")
  if (cleanupError) console.error("[sales-summary] No se pudieron limpiar los límites viejos", { code: cleanupError.code })

  const organizers = await getOrganizerRecipients(["organizer", "superadmin"])
  let sent = 0
  let skipped = 0
  const failures: string[] = []

  for (const organizer of organizers) {
    try {
      const result = await sendOrganizerSalesSummary(
        organizer,
        "now",
        `daily-sales/${organizer.id}/${range.start.toISOString()}`,
        range,
        { skipWithoutSales: true },
      )
      if (result.skipped) skipped += 1
      else sent += 1
    } catch (error) {
      failures.push(organizer.id)
      console.error("[sales-summary] No se pudo enviar el resumen diario", redactForLog(error))
    }
  }

  return Response.json({ success: failures.length === 0, sent, skipped, failed: failures.length, period: range.label })
}

export { GET as POST }
