import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth"
import { redactForLog } from "@/lib/mask-personal-data"

export const dynamic = "force-dynamic"

const MIN_QUERY_LENGTH = 3
const MAX_QUERY_LENGTH = 100
const MAX_RESULTS = 25
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TICKET_FIELDS =
  "id, qr_code, buyer_name, buyer_email, status, payment_status, final_price, purchased_at, verified_at, events(id, title, event_date, slug), ticket_tiers(name)"

type Relation<T> = T | T[] | null

type TicketSearchRow = {
  id: string
  qr_code: string | null
  buyer_name: string | null
  buyer_email: string | null
  status: string | null
  payment_status: string | null
  final_price: number | string | null
  purchased_at: string | null
  verified_at: string | null
  events: Relation<{ id: string; title: string | null; event_date: string | null; slug: string | null }>
  ticket_tiers: Relation<{ name: string | null }>
}

function first<T>(value: Relation<T> | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

/** Escapa los comodines de LIKE para que el texto se busque tal cual. */
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

function normalizeQuery(raw: string | null) {
  return (raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
}

export async function GET(request: Request) {
  const { user, profile } = await requireAuth(["superadmin"])
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  // requireAuth deja pasar usuarios sin perfil; acá exigimos el rol explícito.
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No tenés permiso para buscar entradas" }, { status: 403 })

  const query = normalizeQuery(new URL(request.url).searchParams.get("q"))
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ error: `Escribí al menos ${MIN_QUERY_LENGTH} caracteres` }, { status: 400 })
  }

  const pattern = `%${escapeLikePattern(query)}%`
  const supabase = createClient()
  const base = () => supabase.from("tickets").select(TICKET_FIELDS).order("purchased_at", { ascending: false }).limit(MAX_RESULTS)

  const searches = [
    base().ilike("buyer_email", pattern),
    base().ilike("buyer_name", pattern),
    base().ilike("qr_code", pattern),
  ]
  if (UUID_PATTERN.test(query)) {
    searches.push(base().eq("id", query.toLowerCase()))
    searches.push(base().eq("purchase_group_id", query.toLowerCase()))
  }

  const responses = await Promise.all(searches)
  const failed = responses.find((response) => response.error)
  if (failed?.error) {
    console.error("[superadmin/ticket-search] Error al buscar entradas:", redactForLog(failed.error))
    return NextResponse.json({ error: "No se pudieron buscar las entradas" }, { status: 500 })
  }

  const byId = new Map<string, TicketSearchRow>()
  for (const response of responses) {
    for (const row of (response.data ?? []) as unknown as TicketSearchRow[]) byId.set(row.id, row)
  }

  const results = [...byId.values()]
    .sort((a, b) => new Date(b.purchased_at ?? 0).getTime() - new Date(a.purchased_at ?? 0).getTime())
    .slice(0, MAX_RESULTS)
    .map((row) => {
      const event = first(row.events)
      const tier = first(row.ticket_tiers)
      return {
        id: row.id,
        qrCode: row.qr_code,
        buyerName: row.buyer_name,
        buyerEmail: row.buyer_email,
        status: row.status,
        paymentStatus: row.payment_status,
        finalPrice: row.final_price === null ? null : Number(row.final_price),
        purchasedAt: row.purchased_at,
        used: row.status === "used" || Boolean(row.verified_at),
        usedAt: row.verified_at,
        tierName: tier?.name ?? null,
        event: event ? { id: event.id, title: event.title, date: event.event_date, slug: event.slug } : null,
      }
    })

  return NextResponse.json(
    { results, limited: byId.size > MAX_RESULTS },
    { headers: { "Cache-Control": "no-store" } },
  )
}
