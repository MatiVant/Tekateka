"use client"

import { useMemo, useState } from "react"
import { getMovementTypeLabel } from "@/lib/payment-status"

type RelatedEvent = { title?: string | null } | { title?: string | null }[] | null

type Movement = {
  id: string
  movement_type: string | null
  amount: number | string | null
  created_at: string
  event_id: string | null
  events?: RelatedEvent
  tickets?: { buyer_name?: string | null; buyer_email?: string | null } | { buyer_name?: string | null; buyer_email?: string | null }[] | null
  metadata?: { buyer_name?: string; buyer_email?: string; payment_id?: string; net_received_amount?: number; fee_amount?: number; money_release_date?: string | null } | null
  organizer?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null
}

export type TicketPayment = {
  id: string
  event_id: string
  buyer_name: string | null
  buyer_email: string | null
  buyer_phone: string | null
  status: string | null
  payment_status: string | null
  payment_provider: string | null
  payment_method: string | null
  payment_id: string | null
  mercado_pago_reference: string | null
  final_price: number | string | null
  charged_amount: number | string | null
  payment_fee_amount: number | string | null
  net_amount: number | string | null
  payment_receipt_url: string | null
  payment_notes: string | null
  purchased_at: string | null
  paid_at: string | null
  events?: RelatedEvent
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function formatCurrency(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" })
}

function formatDate(value: string, withTime = false) {
  return new Date(value).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    ...(withTime ? {} : { dateStyle: "short" as const }),
    ...(withTime ? { dateStyle: "short" as const, timeStyle: "short" as const } : {}),
  })
}

function argentinaDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

function readableValue(value: string | null | undefined) {
  if (!value) return "Sin dato"
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase())
}

function safeReceiptUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}

function paymentStatusLabel(status: string | null) {
  const labels: Record<string, string> = {
    approved: "Aprobado",
    confirmed: "Confirmado",
    pending: "Pendiente",
    rejected: "Rechazado",
    cancelled: "Cancelado",
    refunded: "Reintegrado",
    in_process: "En proceso",
  }
  return status ? labels[status] || readableValue(status) : "Sin estado"
}

export function MovementsTable({
  movements,
  tickets = [],
  showOrganizer = false,
}: {
  movements: Movement[]
  tickets?: TicketPayment[]
  showOrganizer?: boolean
}) {
  const [eventFilter, setEventFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("")
  const [activeView, setActiveView] = useState<"movements" | "tickets">("movements")

  const visibleMovements = useMemo(
    () => movements.filter((movement) => movement.movement_type !== "payment_approved" || Boolean(movement.metadata?.payment_id)),
    [movements],
  )

  const events = useMemo(() => {
    const map = new Map<string, string>()
    visibleMovements.forEach((movement) => {
      const event = first(movement.events)
      if (movement.event_id) map.set(movement.event_id, event?.title || "Evento eliminado")
    })
    tickets.forEach((ticket) => {
      const event = first(ticket.events)
      if (ticket.event_id) map.set(ticket.event_id, event?.title || "Evento eliminado")
    })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"))
  }, [visibleMovements, tickets])

  const filteredMovements = visibleMovements.filter((movement) =>
    (eventFilter === "all" || movement.event_id === eventFilter) &&
    (!dateFilter || argentinaDate(movement.created_at) === dateFilter),
  )
  const filteredTickets = tickets.filter((ticket) => {
    const date = ticket.paid_at || ticket.purchased_at
    return (eventFilter === "all" || ticket.event_id === eventFilter) &&
      (!dateFilter || Boolean(date && argentinaDate(date) === dateFilter))
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Tipo de información financiera">
        <button type="button" aria-pressed={activeView === "movements"} onClick={() => setActiveView("movements")} className={`rounded-md px-3 py-2 text-sm font-medium ${activeView === "movements" ? "bg-primary text-primary-foreground" : "border bg-background text-foreground"}`}>
          Movimientos de plataforma <span className="ml-1 opacity-75">({filteredMovements.length})</span>
        </button>
        <button type="button" aria-pressed={activeView === "tickets"} onClick={() => setActiveView("tickets")} className={`rounded-md px-3 py-2 text-sm font-medium ${activeView === "tickets" ? "bg-primary text-primary-foreground" : "border bg-background text-foreground"}`}>
          Entradas y pagos <span className="ml-1 opacity-75">({filteredTickets.length})</span>
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">Evento<select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 font-normal"><option value="all">Todos los eventos</option>{events.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm font-medium">Fecha<input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 font-normal" /></label>
        {(eventFilter !== "all" || dateFilter) && <button type="button" onClick={() => { setEventFilter("all"); setDateFilter("") }} className="self-end text-sm text-primary underline">Limpiar filtros</button>}
      </div>

      {activeView === "movements" ? (
        <>
          <div className="space-y-3 md:hidden">{filteredMovements.map((movement) => {
            const event = first(movement.events)
            const ticket = first(movement.tickets)
            return <article key={movement.id} className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{event?.title || "Evento"}</p><p className="mt-1 text-xs text-muted-foreground">{ticket?.buyer_name || movement.metadata?.buyer_name || "Sin comprador"}</p></div><span className="shrink-0 text-sm font-semibold">{formatCurrency(movement.amount)}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Movimiento: <strong className="text-foreground">{getMovementTypeLabel(movement.movement_type)}</strong></span><span>Fecha: <strong className="text-foreground">{formatDate(movement.created_at)}</strong></span><span className="col-span-2 break-all">Correo: <strong className="text-foreground">{ticket?.buyer_email || movement.metadata?.buyer_email || "Sin dato"}</strong></span></div></article>
          })}{!filteredMovements.length && <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No hay movimientos para estos filtros.</p>}</div>

          <div className="hidden overflow-x-auto rounded-lg border border-border md:block"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-4 text-left">Evento</th>{showOrganizer && <th className="p-4 text-left">Organizador</th>}<th className="p-4 text-left">Movimiento</th><th className="p-4 text-left">Payment ID</th><th className="p-4 text-left">Persona</th><th className="p-4 text-left">Importe</th><th className="p-4 text-left">Fecha</th></tr></thead><tbody>
            {filteredMovements.map((movement) => {
              const event = first(movement.events)
              const ticket = first(movement.tickets)
              const organizer = first(movement.organizer)
              const buyerName = ticket?.buyer_name || movement.metadata?.buyer_name
              const buyerEmail = ticket?.buyer_email || movement.metadata?.buyer_email
              return <tr key={movement.id} className="border-t border-border"><td className="p-4">{event?.title || "Evento eliminado"}</td>{showOrganizer && <td className="p-4"><div>{organizer?.full_name || "Sin nombre"}</div>{organizer?.email && <div className="text-xs text-muted-foreground">{organizer.email}</div>}</td>}<td className="p-4">{getMovementTypeLabel(movement.movement_type)}</td><td className="p-4 font-mono text-xs text-muted-foreground">{movement.metadata?.payment_id || "—"}</td><td className="p-4"><div>{buyerName || "No asociada"}</div>{buyerEmail && <div className="text-xs text-muted-foreground">{buyerEmail}</div>}</td><td className="p-4">{formatCurrency(movement.amount)}</td><td className="p-4 text-muted-foreground">{formatDate(movement.created_at, true)}</td></tr>
            })}
            {!filteredMovements.length && <tr><td colSpan={showOrganizer ? 7 : 6} className="p-8 text-center text-muted-foreground">No hay movimientos para estos filtros.</td></tr>}
          </tbody></table></div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Incluye entradas pagadas o pendientes, tanto por Mercado Pago como por transferencia. La fecha mostrada es la del pago o, si no está disponible, la de compra.</p>
          <div className="space-y-3 md:hidden">{filteredTickets.map((ticket) => {
            const event = first(ticket.events)
            const date = ticket.paid_at || ticket.purchased_at
            return <article key={ticket.id} className="space-y-3 rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{event?.title || "Evento eliminado"}</p><p className="mt-1 text-sm">{ticket.buyer_name || "Sin comprador"}</p><p className="break-all text-xs text-muted-foreground">{ticket.buyer_email || "Sin correo"}{ticket.buyer_phone ? ` · ${ticket.buyer_phone}` : ""}</p></div><span className="shrink-0 font-semibold">{formatCurrency(ticket.charged_amount ?? ticket.final_price)}</span></div><div className="grid grid-cols-2 gap-2 text-xs"><span className="text-muted-foreground">Estado: <strong className="text-foreground">{paymentStatusLabel(ticket.payment_status)} / entrada {paymentStatusLabel(ticket.status)}</strong></span><span className="text-muted-foreground">Pago: <strong className="text-foreground">{readableValue(ticket.payment_method || ticket.payment_provider)}</strong></span><span className="text-muted-foreground">Comisión: <strong className="text-foreground">{formatCurrency(ticket.payment_fee_amount)}</strong></span><span className="text-muted-foreground">Neto: <strong className="text-foreground">{formatCurrency(ticket.net_amount)}</strong></span><span className="col-span-2 text-muted-foreground">Fecha: <strong className="text-foreground">{date ? formatDate(date, true) : "Sin fecha"}</strong></span></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{(ticket.payment_id || ticket.mercado_pago_reference) && <span className="break-all text-muted-foreground">Referencia: {ticket.payment_id || ticket.mercado_pago_reference}</span>}{safeReceiptUrl(ticket.payment_receipt_url) && <a href={safeReceiptUrl(ticket.payment_receipt_url)!} target="_blank" rel="noreferrer" className="font-medium text-primary underline">Ver comprobante</a>}</div>{ticket.payment_notes && <p className="text-xs text-muted-foreground">Nota: {ticket.payment_notes}</p>}</article>
          })}{!filteredTickets.length && <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No hay entradas para estos filtros.</p>}</div>

          <div className="hidden overflow-x-auto rounded-lg border border-border md:block"><table className="min-w-[1150px] w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-left">Evento</th><th className="p-3 text-left">Comprador</th><th className="p-3 text-left">Estado</th><th className="p-3 text-left">Método</th><th className="p-3 text-right">Importe</th><th className="p-3 text-right">Comisión / neto</th><th className="p-3 text-left">Referencia</th><th className="p-3 text-left">Comprobante / nota</th><th className="p-3 text-left">Fecha</th></tr></thead><tbody>
            {filteredTickets.map((ticket) => {
              const event = first(ticket.events)
              const date = ticket.paid_at || ticket.purchased_at
              return <tr key={ticket.id} className="border-t border-border align-top"><td className="max-w-56 p-3">{event?.title || "Evento eliminado"}</td><td className="p-3"><div>{ticket.buyer_name || "Sin comprador"}</div><div className="text-xs text-muted-foreground">{ticket.buyer_email || "Sin correo"}</div>{ticket.buyer_phone && <div className="text-xs text-muted-foreground">{ticket.buyer_phone}</div>}</td><td className="p-3">{paymentStatusLabel(ticket.payment_status || ticket.status)}</td><td className="p-3">{readableValue(ticket.payment_method || ticket.payment_provider)}</td><td className="p-3 text-right">{formatCurrency(ticket.charged_amount ?? ticket.final_price)}</td><td className="whitespace-nowrap p-3 text-right"><div>{formatCurrency(ticket.payment_fee_amount)}</div><div className="text-xs text-muted-foreground">Neto {formatCurrency(ticket.net_amount)}</div></td><td className="max-w-40 break-all p-3 font-mono text-xs text-muted-foreground">{ticket.payment_id || ticket.mercado_pago_reference || "—"}</td><td className="max-w-48 p-3 text-xs">{safeReceiptUrl(ticket.payment_receipt_url) && <a href={safeReceiptUrl(ticket.payment_receipt_url)!} target="_blank" rel="noreferrer" className="text-primary underline">Ver comprobante</a>}{ticket.payment_receipt_url && ticket.payment_notes && <span className="text-muted-foreground"> · </span>}{ticket.payment_notes && <span className="text-muted-foreground">{ticket.payment_notes}</span>}{!ticket.payment_receipt_url && !ticket.payment_notes && <span className="text-muted-foreground">—</span>}</td><td className="whitespace-nowrap p-3 text-muted-foreground">{date ? formatDate(date, true) : "Sin fecha"}</td></tr>
            })}
            {!filteredTickets.length && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No hay entradas para estos filtros.</td></tr>}
          </tbody></table></div>
        </>
      )}
    </div>
  )
}

export default MovementsTable
