"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2, Mail, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { formatArgentinaDateTime, ARGENTINA_TIME_ZONE } from "@/lib/date"
import { formatCurrency } from "@/lib/format"
import { getPaymentStatusLabel, getTicketStatusLabel } from "@/lib/payment-status"

export type TicketSearchEventOption = { id: string; title: string | null; event_date: string | null }

type TicketReceipt = {
  state: "yes" | "no" | "not_required"
  url: string | null
  shared: boolean
}

type TicketSearchResult = {
  id: string
  qrCode: string | null
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  status: string | null
  paymentStatus: string | null
  paymentMethod: string | null
  finalPrice: number | null
  purchasedAt: string | null
  paidAt: string | null
  used: boolean
  usedAt: string | null
  purchaseGroupId: string | null
  receipt: TicketReceipt
  tierName: string | null
  event: { id: string; title: string | null; date: string | null; slug: string | null } | null
}

const MIN_QUERY_LENGTH = 3
const PAGE_SIZE = 10
const DEBOUNCE_MS = 400
const ALL = "all"

const STATUS_OPTIONS = [
  { value: ALL, label: "Todos los estados" },
  { value: "approved", label: "Pagadas" },
  { value: "pending", label: "Pendientes" },
  { value: "used", label: "Usadas" },
  { value: "cancelled", label: "Canceladas" },
]

const RECEIPT_OPTIONS = [
  { value: ALL, label: "Con o sin comprobante" },
  { value: "with", label: "Con comprobante" },
  { value: "without", label: "Sin comprobante" },
]

function formatShortDate(value: string | null, withTime = true) {
  if (!value) return "Sin fecha"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: ARGENTINA_TIME_ZONE,
  })
}

function paymentBadgeVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved") return "default"
  if (status === "rejected") return "destructive"
  if (status === "submitted") return "secondary"
  return "outline"
}

function canResend(ticket: TicketSearchResult) {
  return ticket.status === "confirmed" && ticket.paymentStatus === "approved" && Boolean(ticket.buyerEmail)
}

function StatusBadges({ ticket }: { ticket: TicketSearchResult }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={paymentBadgeVariant(ticket.paymentStatus)} className="text-[11px]">{getPaymentStatusLabel(ticket.paymentStatus)}</Badge>
      {ticket.status && ticket.status !== "confirmed" && ticket.status !== "used" && (
        <Badge variant="outline" className="text-[11px]">{getTicketStatusLabel(ticket.status)}</Badge>
      )}
      {ticket.used && <Badge variant="secondary" className="text-[11px]">Usada</Badge>}
    </div>
  )
}

function ReceiptBadge({ receipt, withLink = true }: { receipt: TicketReceipt; withLink?: boolean }) {
  if (receipt.state === "yes") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Badge variant="default" className="text-[11px]">Comprobante: Sí{receipt.shared ? " (de la compra)" : ""}</Badge>
        {withLink && receipt.url && (
          <a
            href={receipt.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            ver<ExternalLink className="h-3 w-3" />
          </a>
        )}
      </span>
    )
  }
  if (receipt.state === "no") return <Badge variant="destructive" className="text-[11px]">Comprobante: No</Badge>
  return <Badge variant="outline" className="text-[11px] text-muted-foreground">Comprobante: No aplica</Badge>
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

export function TicketSearch({ events }: { events: TicketSearchEventOption[] }) {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [eventId, setEventId] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [receiptFilter, setReceiptFilter] = useState(ALL)
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<TicketSearchResult[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<TicketSearchResult | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const trimmed = debouncedQuery.trim()
  const textTooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH
  const hasFilters = eventId !== ALL || status !== ALL || receiptFilter !== ALL
  const canSearch = !textTooShort && (trimmed.length >= MIN_QUERY_LENGTH || hasFilters)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query)
      setPage(1)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [query])

  const runSearch = useCallback(async () => {
    requestRef.current?.abort()
    if (!canSearch) {
      setResults(null)
      setTotal(0)
      setError(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (trimmed) params.set("q", trimmed)
    if (eventId !== ALL) params.set("eventId", eventId)
    if (status !== ALL) params.set("status", status)
    if (receiptFilter !== ALL) params.set("receipt", receiptFilter)
    try {
      const response = await fetch(`/api/superadmin/ticket-search?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "No se pudo buscar")
      setResults(data.results ?? [])
      setTotal(Number(data.total ?? 0))
    } catch (err) {
      if (controller.signal.aborted) return
      setResults(null)
      setTotal(0)
      setError(err instanceof Error ? err.message : "No se pudo buscar")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [canSearch, page, trimmed, eventId, status, receiptFilter])

  useEffect(() => {
    // Se agenda para después del render: así los setState quedan fuera del cuerpo del efecto.
    const timeout = setTimeout(() => void runSearch(), 0)
    return () => clearTimeout(timeout)
  }, [runSearch])

  useEffect(() => () => requestRef.current?.abort(), [])

  async function resendEmail(ticket: TicketSearchResult) {
    if (!window.confirm(`¿Reenviar la entrada a ${ticket.buyerEmail}?`)) return
    setResendingId(ticket.id)
    try {
      const response = await fetch("/api/resend-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "No se pudo reenviar el mail")
      toast({ title: "Mail reenviado", description: `Le mandamos de nuevo la entrada a ${ticket.buyerEmail}.` })
    } catch (err) {
      toast({ title: "No se pudo reenviar", description: err instanceof Error ? err.message : "Error inesperado", variant: "destructive" })
    } finally {
      setResendingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(page * PAGE_SIZE, total)

  const openRow = (ticket: TicketSearchResult) => setSelected(ticket)
  const onRowKeyDown = (event: React.KeyboardEvent, ticket: TicketSearchResult) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openRow(ticket)
    }
  }

  return (
    <section aria-label="Buscar entradas" className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Search className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Buscar entradas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Buscá por email, nombre o código de la entrada, o filtrá por evento, estado y comprobante de pago.</p>
        </div>
      </div>

      <form
        className="mt-4 grid gap-2 md:grid-cols-[1fr_14rem_11rem_12rem_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          setDebouncedQuery(query)
          setPage(1)
          if (query === debouncedQuery && page === 1) void runSearch()
        }}
      >
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Email, nombre o código del QR"
          aria-label="Email, nombre o código de entrada"
          maxLength={100}
          autoComplete="off"
        />
        <Select value={eventId} onValueChange={(value) => { setEventId(value); setPage(1) }}>
          <SelectTrigger aria-label="Filtrar por evento" className="w-full"><SelectValue placeholder="Todos los eventos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los eventos</SelectItem>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {(event.title || "Sin título") + (event.event_date ? ` · ${formatShortDate(event.event_date, false)}` : "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1) }}>
          <SelectTrigger aria-label="Filtrar por estado" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={receiptFilter} onValueChange={(value) => { setReceiptFilter(value); setPage(1) }}>
          <SelectTrigger aria-label="Filtrar por comprobante" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RECEIPT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando...</> : "Buscar"}
        </Button>
      </form>

      {textTooShort && <p className="mt-2 text-xs text-muted-foreground">Escribí al menos {MIN_QUERY_LENGTH} caracteres.</p>}
      {!canSearch && !textTooShort && <p className="mt-2 text-xs text-muted-foreground">Escribí algo o elegí un filtro para ver entradas.</p>}

      {error && <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>}

      {results && results.length === 0 && !loading && !error && (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No encontramos entradas con eso.</p>
      )}

      {results && results.length > 0 && (
        <div className={`mt-4 ${loading ? "opacity-60" : ""}`}>
          {/* Escritorio: tabla compacta */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Comprador</th>
                  <th className="px-3 py-2 font-medium">Evento</th>
                  <th className="px-3 py-2 font-medium">Compra</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Comprobante</th>
                  <th className="px-3 py-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {results.map((ticket) => (
                  <tr
                    key={ticket.id}
                    tabIndex={0}
                    onClick={() => openRow(ticket)}
                    onKeyDown={(event) => onRowKeyDown(event, ticket)}
                    className="cursor-pointer border-t outline-none hover:bg-muted/40 focus-visible:bg-muted/60"
                  >
                    <td className="max-w-[14rem] px-3 py-2">
                      <p className="truncate font-medium">{ticket.buyerName || "Sin nombre"}</p>
                      <p className="truncate text-xs text-muted-foreground">{ticket.buyerEmail}</p>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2">
                      <p className="truncate">{ticket.event?.title || "Evento sin título"}</p>
                      <p className="text-xs text-muted-foreground">{formatShortDate(ticket.event?.date ?? null)}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatShortDate(ticket.purchasedAt)}</td>
                    <td className="px-3 py-2"><StatusBadges ticket={ticket} /></td>
                    <td className="px-3 py-2"><ReceiptBadge receipt={ticket.receipt} /></td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); openRow(ticket) }}>Ver detalle</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: filas de dos líneas */}
          <ul className="divide-y rounded-lg border md:hidden">
            {results.map((ticket) => (
              <li key={ticket.id}>
                <button type="button" onClick={() => openRow(ticket)} className="w-full px-3 py-2 text-left hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{ticket.buyerName || ticket.buyerEmail || "Sin nombre"}</p>
                    <StatusBadges ticket={ticket} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{ticket.event?.title || "Evento sin título"} · {formatShortDate(ticket.purchasedAt, false)}</p>
                  <div className="mt-1"><ReceiptBadge receipt={ticket.receipt} withLink={false} /></div>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-xs text-muted-foreground">Mostrando {firstShown}–{lastShown} de {total}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                <ChevronLeft className="mr-1 h-4 w-4" />Anterior
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
                Siguiente<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-6">{selected.buyerName || "Entrada"}</SheetTitle>
                <SheetDescription>{selected.event?.title || "Evento sin título"}</SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <StatusBadges ticket={selected} />
                <dl className="mt-3 divide-y">
                  <DetailRow label="Email">{selected.buyerEmail || "—"}</DetailRow>
                  {selected.buyerPhone && <DetailRow label="Teléfono">{selected.buyerPhone}</DetailRow>}
                  <DetailRow label="Evento">{selected.event?.title || "—"}</DetailRow>
                  <DetailRow label="Fecha del evento">{selected.event?.date ? formatArgentinaDateTime(selected.event.date) : "—"}</DetailRow>
                  {selected.tierName && <DetailRow label="Tipo de entrada">{selected.tierName}</DetailRow>}
                  <DetailRow label="Precio">{selected.finalPrice !== null ? formatCurrency(selected.finalPrice) : "—"}</DetailRow>
                  <DetailRow label="Pago">{getPaymentStatusLabel(selected.paymentStatus)}{selected.paymentMethod ? ` · ${selected.paymentMethod}` : ""}</DetailRow>
                  <DetailRow label="Comprobante">
                    <ReceiptBadge receipt={selected.receipt} withLink={false} />
                    {selected.receipt.state === "yes" && selected.receipt.shared && (
                      <p className="mt-1 text-xs text-muted-foreground">Es el comprobante de la compra: está cargado en otra entrada del mismo pedido.</p>
                    )}
                  </DetailRow>
                  <DetailRow label="Estado">{getTicketStatusLabel(selected.status)}</DetailRow>
                  <DetailRow label="Comprada">{formatShortDate(selected.purchasedAt)}</DetailRow>
                  {selected.paidAt && <DetailRow label="Pagada">{formatShortDate(selected.paidAt)}</DetailRow>}
                  <DetailRow label="Ingreso">{selected.used ? (selected.usedAt ? `Usada el ${formatShortDate(selected.usedAt)}` : "Ya usada") : "Todavía no ingresó"}</DetailRow>
                  {selected.qrCode && <DetailRow label="Código"><span className="font-mono text-xs break-all">{selected.qrCode}</span></DetailRow>}
                </dl>
              </div>
              <div className="flex flex-col gap-2 p-4">
                {selected.receipt.state === "yes" && selected.receipt.url && (
                  <Button asChild variant="outline">
                    <a href={selected.receipt.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />Ver comprobante de pago
                    </a>
                  </Button>
                )}
                {selected.qrCode && (
                  <Button asChild variant="outline">
                    <a href={`/ticket/${encodeURIComponent(selected.qrCode)}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />Ver entrada y QR
                    </a>
                  </Button>
                )}
                {canResend(selected) && (
                  <Button type="button" onClick={() => resendEmail(selected)} disabled={resendingId === selected.id}>
                    {resendingId === selected.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Reenviar mail
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}
