import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { requireSuperadmin } from "@/lib/auth"
import { redactForLog } from "@/lib/mask-personal-data"

export const dynamic = "force-dynamic"

const MIN_QUERY_LENGTH = 3
const MAX_QUERY_LENGTH = 100
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUS_FILTERS = ["all", "approved", "pending", "used", "cancelled"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]
const RECEIPT_FILTERS = ["all", "with", "without"] as const
type ReceiptFilter = (typeof RECEIPT_FILTERS)[number]

// Métodos de pago en los que el comprador tiene que subir un comprobante.
// Gratis y Mercado Pago no lo necesitan: el pago lo confirma la plataforma.
const RECEIPT_METHODS = ["transfer", "transferencia", "external_link"]
const NO_RECEIPT_METHODS = ["free", "mercado_pago", "mercadopago"]

const TICKET_FIELDS =
  "id, qr_code, buyer_name, buyer_email, buyer_phone, status, payment_status, payment_method, final_price, purchased_at, paid_at, verified_at, purchase_group_id, payment_id, payment_receipt_url, events(id, title, event_date, slug), ticket_tiers(name)"

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
  payment_id: string | null
  payment_receipt_url: string | null
  events: Relation<{ id: string; title: string | null; event_date: string | null; slug: string | null }>
  ticket_tiers: Relation<{ name: string | null }>
}

function cleanReceiptUrl(value: string | null | undefined) {
  const url = (value ?? "").trim()
  // Solo se devuelven links http(s): el comprobante se abre desde un <a href>.
  return /^https?:\/\//i.test(url) ? url : null
}

type ReceiptInfo = {
  /** yes: hay comprobante · no: falta y corresponde · not_required: no aplica (gratis, Mercado Pago) */
  state: "yes" | "no" | "not_required"
  url: string | null
  /** El comprobante está cargado en otra entrada de la misma compra. */
  shared: boolean
}

function receiptRequired(row: TicketSearchRow) {
  const method = (row.payment_method ?? "").toLowerCase()
  if (NO_RECEIPT_METHODS.includes(method)) return false
  if (row.final_price !== null && Number(row.final_price) === 0) return false
  return true
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
  const { authorized, user } = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!authorized) return NextResponse.json({ error: "No tenés permiso para buscar entradas" }, { status: 403 })

  const params = new URL(request.url).searchParams
  const query = sanitizeQuery(params.get("q"))
  const eventIdParam = (params.get("eventId") ?? "").trim()
  const statusParam = (params.get("status") ?? "all") as StatusFilter
  const pageSize = parsePositiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const page = parsePositiveInt(params.get("page"), 1, 10_000)
  const receiptParam = (params.get("receipt") ?? "all") as ReceiptFilter

  if (eventIdParam && !UUID_PATTERN.test(eventIdParam)) return NextResponse.json({ error: "Evento inválido" }, { status: 400 })
  if (!STATUS_FILTERS.includes(statusParam)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
  if (!RECEIPT_FILTERS.includes(receiptParam)) return NextResponse.json({ error: "Filtro de comprobante inválido" }, { status: 400 })
  if (query.length > 0 && query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ error: `Escribí al menos ${MIN_QUERY_LENGTH} caracteres` }, { status: 400 })
  }
  if (!query && !eventIdParam && statusParam === "all" && receiptParam === "all") {
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

  if (receiptParam === "with") search = search.not("payment_receipt_url", "is", null).neq("payment_receipt_url", "")
  if (receiptParam === "without") {
    // Solo entradas en las que corresponde comprobante (transferencia / link externo) y todavía no lo cargaron.
    search = search.or("payment_receipt_url.is.null,payment_receipt_url.eq.").in("payment_method", RECEIPT_METHODS)
  }

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

  const rows = (data ?? []) as unknown as TicketSearchRow[]

  // Una compra de varias entradas comparte un solo comprobante. Si a esta entrada no se le guardó
  // pero a otra de la misma compra sí, se lo mostramos igual (marcado como compartido).
  const groupReceipts = new Map<string, string>()
  const paymentReceipts = new Map<string, string>()
  const missing = rows.filter((row) => !cleanReceiptUrl(row.payment_receipt_url) && receiptRequired(row))
  const groupIds = [...new Set(missing.map((row) => row.purchase_group_id).filter((id): id is string => Boolean(id)))]
  const paymentIds = [...new Set(missing.map((row) => row.payment_id).filter((id): id is string => Boolean(id)))]
  if (groupIds.length > 0) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("tickets")
      .select("purchase_group_id, payment_receipt_url")
      .in("purchase_group_id", groupIds)
      .not("payment_receipt_url", "is", null)
    if (siblingsError) console.error("[superadmin/ticket-search] Error al buscar comprobantes de la compra:", redactForLog({ code: siblingsError.code, message: siblingsError.message }))
    for (const sibling of siblings ?? []) {
      const url = cleanReceiptUrl(sibling.payment_receipt_url)
      if (url && sibling.purchase_group_id && !groupReceipts.has(sibling.purchase_group_id)) groupReceipts.set(sibling.purchase_group_id, url)
    }
  }
  if (paymentIds.length > 0) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("tickets")
      .select("payment_id, payment_receipt_url")
      .in("payment_id", paymentIds)
      .not("payment_receipt_url", "is", null)
    if (siblingsError) console.error("[superadmin/ticket-search] Error al buscar comprobantes del pago:", redactForLog({ code: siblingsError.code, message: siblingsError.message }))
    for (const sibling of siblings ?? []) {
      const url = cleanReceiptUrl(sibling.payment_receipt_url)
      if (url && sibling.payment_id && !paymentReceipts.has(sibling.payment_id)) paymentReceipts.set(sibling.payment_id, url)
    }
  }

  const results = rows.map((row) => {
    const ownUrl = cleanReceiptUrl(row.payment_receipt_url)
    const sharedUrl = ownUrl ? null : (row.purchase_group_id && groupReceipts.get(row.purchase_group_id)) || (row.payment_id && paymentReceipts.get(row.payment_id)) || null
    const receiptUrl = ownUrl ?? sharedUrl
    const receipt: ReceiptInfo = receiptUrl
      ? { state: "yes", url: receiptUrl, shared: Boolean(sharedUrl) }
      : { state: receiptRequired(row) ? "no" : "not_required", url: null, shared: false }
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
      receipt,
      tierName: tier?.name ?? null,
      event: event ? { id: event.id, title: event.title, date: event.event_date, slug: event.slug } : null,
    }
  })

  return NextResponse.json({ results, total: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "no-store" } })
}
