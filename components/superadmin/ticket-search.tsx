"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, ExternalLink, Loader2, Mail, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { formatArgentinaDateTime, ARGENTINA_TIME_ZONE } from "@/lib/date"
import { formatCurrency } from "@/lib/format"
import { getPaymentStatusLabel, getTicketStatusLabel } from "@/lib/payment-status"

type TicketSearchResult = {
  id: string
  qrCode: string | null
  buyerName: string | null
  buyerEmail: string | null
  status: string | null
  paymentStatus: string | null
  finalPrice: number | null
  purchasedAt: string | null
  used: boolean
  usedAt: string | null
  tierName: string | null
  event: { id: string; title: string | null; date: string | null; slug: string | null } | null
}

const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 400

function formatShortDate(value: string | null) {
  if (!value) return "Sin fecha"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"
  return date.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ARGENTINA_TIME_ZONE })
}

function paymentBadgeVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved") return "default"
  if (status === "rejected") return "destructive"
  if (status === "submitted") return "secondary"
  return "outline"
}

export function TicketSearch() {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TicketSearchResult[] | null>(null)
  const [limited, setLimited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  async function runSearch(value: string) {
    const trimmed = value.trim()
    requestRef.current?.abort()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null)
      setError(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/superadmin/ticket-search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal, cache: "no-store" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "No se pudo buscar")
      setResults(data.results ?? [])
      setLimited(Boolean(data.limited))
    } catch (err) {
      if (controller.signal.aborted) return
      setResults(null)
      setError(err instanceof Error ? err.message : "No se pudo buscar")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => void runSearch(query), DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [query])

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

  const trimmedLength = query.trim().length

  return (
    <section aria-label="Buscar entradas" className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Search className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Buscar entradas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Buscá por email, nombre del comprador o código de la entrada.</p>
        </div>
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void runSearch(query)
        }}
      >
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ej: juan@gmail.com, Juan Pérez o el código del QR"
          aria-label="Email, nombre o código de entrada"
          maxLength={100}
          autoComplete="off"
          className="sm:flex-1"
        />
        <Button type="submit" disabled={loading || trimmedLength < MIN_QUERY_LENGTH}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando...</> : "Buscar"}
        </Button>
      </form>

      {trimmedLength > 0 && trimmedLength < MIN_QUERY_LENGTH && (
        <p className="mt-2 text-xs text-muted-foreground">Escribí al menos {MIN_QUERY_LENGTH} caracteres.</p>
      )}

      {error && <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>}

      {results && results.length === 0 && !loading && !error && (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No encontramos entradas con eso.</p>
      )}

      {results && results.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {results.length} {results.length === 1 ? "entrada encontrada" : "entradas encontradas"}
            {limited && " (mostramos las más recientes; afiná la búsqueda para ver otras)"}
          </p>
          <ul className="space-y-3">
            {results.map((ticket) => {
              const canResend = ticket.status === "confirmed" && ticket.paymentStatus === "approved" && Boolean(ticket.buyerEmail)
              return (
                <li key={ticket.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold break-words">{ticket.event?.title || "Evento sin título"}</p>
                      <p className="text-xs text-muted-foreground">{ticket.event?.date ? formatArgentinaDateTime(ticket.event.date) : "Fecha del evento no disponible"}</p>
                      <p className="text-sm break-words">
                        <span className="font-medium">{ticket.buyerName || "Sin nombre"}</span>
                        {ticket.buyerEmail && <span className="text-muted-foreground"> · {ticket.buyerEmail}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.tierName ? `${ticket.tierName} · ` : ""}
                        {ticket.finalPrice !== null ? formatCurrency(ticket.finalPrice) : "Sin precio"} · Comprada el {formatShortDate(ticket.purchasedAt)}
                      </p>
                      {ticket.qrCode && <p className="font-mono text-xs text-muted-foreground break-all">Código: {ticket.qrCode}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Badge variant={paymentBadgeVariant(ticket.paymentStatus)}>{getPaymentStatusLabel(ticket.paymentStatus)}</Badge>
                      <Badge variant="outline">{getTicketStatusLabel(ticket.status)}</Badge>
                      {ticket.used && <Badge variant="secondary">{ticket.usedAt ? `Usada el ${formatShortDate(ticket.usedAt)}` : "Ya usada"}</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    {ticket.qrCode && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`/ticket/${encodeURIComponent(ticket.qrCode)}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />Ver entrada y QR
                        </a>
                      </Button>
                    )}
                    {canResend && (
                      <Button type="button" variant="outline" size="sm" onClick={() => resendEmail(ticket)} disabled={resendingId === ticket.id}>
                        {resendingId === ticket.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                        Reenviar mail
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
