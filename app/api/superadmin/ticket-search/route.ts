import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth"
import { redactForLog } from "@/lib/mask-personal-data"

export const dynamic = "force-dynamic"

const MIN_QUERY_LENGTH = 3
const MAX_QUERY_LENGTH = 100
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUS_FILTERS = ["all", "approved", "pending", "used", "cancelled"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const TICKET_FIELDS =
  "id, qr_code, buyer_name, buyer_email, buyer_phone, status, payment_status, payment_method, final_price, purchased_at, paid_at, verified_at, purchase_group_id, events(id, title, event_date, slug), ticket_tiers(name)"

type Relation<T> = T | T[] | null

type TicketSearchRow = {
  id: string
  qr_code: string | null
  buyer_name: string | null
  buyer_email: string | null
  buyer_phone: string | null
  status: string | null
  payment_status: string | null
  payment_method: string | null
  final_price: number | string | null
  purchased_at: string | null
  paid_at: string | null
  verified_at: string | null
  purchase_group_id: string | null
  events: Relation<{ id: string; title: string | null; event_date: string | null; slug: string | null }>
  ticket_tiers: Relation<{ name: string | null }>
}

function first<T>(value: Relation<T> | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

/**
 * Deja solo letras, números, espacios y los signos que aparecen en emails,
 * nombres y códigos (@ . _ - + '). Así no pueden entrar los caracteres
 * especiales de PostgREST ( , ( ) : " \ ) ni los comodines % y *.
 */
function sanitizeQuery(raw: string | null) {
  return (raw ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} @._+'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

export async function GET(request: Request) {
  const { user, profile } = await requireAuth(["superadmin"])
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  // requireAuth deja pasar usuarios sin perfil; acá exigimos el rol explícito.
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No tenés permiso para buscar entradas" }, { status: 403 })

  const params = new URL(request.url).searchParams
  const query = sanitizeQuery(params.get("q"))
  const eventIdParam = (params.get("eventId") ?? "").trim()
  const statusParam = (params.get("status") ?? "all") as StatusFilter
  const pageSize = parsePositiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const page = parsePositiveInt(params.get("page"), 1, 10_000)

  if (eventIdParam && !UUID_PATTERN.test(eventIdParam)) return NextResponse.json({ error: "Evento inválido" }, { status: 400 })
  if (!STATUS_FILTERS.includes(statusParam)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
  if (query.length > 0 && query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ error: `Escribí al menos ${MIN_QUERY_LENGTH} caracteres` }, { status: 400 })
  }
  if (!query && !eventIdParam && statusParam === "all") {
    return NextResponse.json({ error: "Escribí algo para buscar o elegí un filtro" }, { status: 400 })
  }

  const supabase = createClient()
  let search = supabase.from("tickets").select(TICKET_FIELDS, { count: "exact" })

  if (query) {
    // El texto ya está saneado (sin , ( ) : " \ % *) y además va entre comillas dobles.
    // El "_" que pueda quedar actúa como comodín de un carácter: solo amplía un poco la búsqueda.
    const pattern = `"%${query}%"`
    const conditions = [`buyer_email.ilike.${pattern}`, `buyer_name.ilike.${pattern}`, `qr_code.ilike.${pattern}`]
    if (UUID_PATTERN.test(query)) {
      const id = query.toLowerCase()
      conditions.push(`id.eq.${id}`, `purchase_group_id.eq.${id}`)
    }
    search = search.or(conditions.join(","))
  }
  if (eventIdParam) search = search.eq("event_id", eventIdParam)
  if (statusParam === "approved") search = search.eq("payment_status", "approved")
  if (statusParam === "pending") search = search.in("payment_status", ["pending", "submitted"]).neq("status", "cancelled")
  if (statusParam === "used") search = search.eq("status", "used")
  if (statusParam === "cancelled") search = search.eq("status", "cancelled")

  const from = (page - 1) * pageSize
  const { data, count, error } = await search
    .order("purchased_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1)

  if (error) {
    // Pedir una página que ya no existe devuelve 416 en PostgREST: lo tratamos como vacía.
    if (error.code === "PGRST103") {
      return NextResponse.json({ results: [], total: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "no-store" } })
    }
    console.error("[superadmin/ticket-search] Error al buscar entradas:", redactForLog({ code: error.code, message: error.message }))
    return NextResponse.json({ error: "No se pudieron buscar las entradas" }, { status: 500 })
  }

  const results = ((data ?? []) as unknown as TicketSearchRow[]).map((row) => {
    const event = first(row.events)
    const tier = first(row.ticket_tiers)
    return {
      id: row.id,
      qrCode: row.qr_code,
      buyerName: row.buyer_name,
      buyerEmail: row.buyer_email,
      buyerPhone: row.buyer_phone,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      finalPrice: row.final_price === null ? null : Number(row.final_price),
      purchasedAt: row.purchased_at,
      paidAt: row.paid_at,
      used: row.status === "used" || Boolean(row.verified_at),
      usedAt: row.verified_at,
      purchaseGroupId: row.purchase_group_id,
      tierName: tier?.name ?? null,
      event: event ? { id: event.id, title: event.title, date: event.event_date, slug: event.slug } : null,
    }
  })

  return NextResponse.json({ results, total: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "no-store" } })
}
