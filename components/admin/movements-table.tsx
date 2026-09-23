"use client"

import { useMemo, useState } from "react"
import { getMovementTypeLabel } from "@/lib/payment-status"

type Movement = {
  id: string
  movement_type: string | null
  amount: number | string | null
  created_at: string
  event_id: string | null
  events?: { title?: string | null } | { title?: string | null }[] | null
  tickets?: { buyer_name?: string | null; buyer_email?: string | null } | { buyer_name?: string | null; buyer_email?: string | null }[] | null
  metadata?: { buyer_name?: string; buyer_email?: string; payment_id?: string; net_received_amount?: number; fee_amount?: number; money_release_date?: string | null } | null
  organizer?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null
}

export function MovementsTable({ movements, showOrganizer = false }: { movements: Movement[]; showOrganizer?: boolean }) {
  const [eventFilter, setEventFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("")
  const visibleMovements = useMemo(
    () => movements.filter((movement) => movement.movement_type !== "payment_approved" || Boolean(movement.metadata?.payment_id)),
    [movements],
  )
  const events = useMemo(() => {
    const map = new Map<string, string>()
    visibleMovements.forEach((movement) => {
      const event = Array.isArray(movement.events) ? movement.events[0] : movement.events
      if (movement.event_id) map.set(movement.event_id, event?.title || "Evento eliminado")
    })
    return [...map.entries()]
  }, [visibleMovements])
  const filtered = visibleMovements.filter((movement) => (eventFilter === "all" || movement.event_id === eventFilter) && (!dateFilter || movement.created_at.slice(0, 10) === dateFilter))

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">Evento<select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 font-normal"><option value="all">Todos los eventos</option>{events.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-medium">Fecha<input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 font-normal" /></label>
      {(eventFilter !== "all" || dateFilter) && <button type="button" onClick={() => { setEventFilter("all"); setDateFilter("") }} className="self-end text-sm text-primary underline">Limpiar filtros</button>}
    </div>
    <div className="space-y-3 md:hidden">{filtered.map((movement) => { const event = Array.isArray(movement.events) ? movement.events[0] : movement.events; const ticket = Array.isArray(movement.tickets) ? movement.tickets[0] : movement.tickets; return <article key={movement.id} className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{event?.title || "Evento"}</p><p className="mt-1 text-xs text-muted-foreground">{ticket?.buyer_name || "Sin comprador"}</p></div><span className="shrink-0 text-sm font-semibold">{Number(movement.amount || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Movimiento: <strong className="text-foreground">{getMovementTypeLabel(movement.movement_type)}</strong></span><span>Fecha: <strong className="text-foreground">{new Date(movement.created_at).toLocaleDateString("es-AR")}</strong></span></div></article> })}</div>

  <div className="hidden overflow-x-auto rounded-lg border border-border md:block"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-4 text-left">Evento</th>{showOrganizer && <th className="p-4 text-left">Organizador</th>}<th className="p-4 text-left">Movimiento</th><th className="p-4 text-left">Payment ID</th><th className="p-4 text-left">Persona</th><th className="p-4 text-left">Importe</th><th className="p-4 text-left">Fecha</th></tr></thead><tbody>
      {filtered.map((movement) => {
        const event = Array.isArray(movement.events) ? movement.events[0] : movement.events
        const ticket = Array.isArray(movement.tickets) ? movement.tickets[0] : movement.tickets
        const organizer = Array.isArray(movement.organizer) ? movement.organizer[0] : movement.organizer
        const buyerName = ticket?.buyer_name || movement.metadata?.buyer_name
        const buyerEmail = ticket?.buyer_email || movement.metadata?.buyer_email
        return <tr key={movement.id} className="border-t border-border"><td className="p-4">{event?.title || "Evento eliminado"}</td>{showOrganizer && <td className="p-4"><div>{organizer?.full_name || "Sin nombre"}</div>{organizer?.email && <div className="text-xs text-muted-foreground">{organizer.email}</div>}</td>}<td className="p-4">{getMovementTypeLabel(movement.movement_type)}</td><td className="p-4 font-mono text-xs text-muted-foreground">{movement.metadata?.payment_id || "—"}</td><td className="p-4"><div>{buyerName || "No asociada"}</div>{buyerEmail && <div className="text-xs text-muted-foreground">{buyerEmail}</div>}</td><td className="p-4">{Number(movement.amount || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</td><td className="p-4 text-muted-foreground">{new Date(movement.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</td></tr>
      })}
      {!filtered.length && <tr><td colSpan={showOrganizer ? 7 : 6} className="p-8 text-center text-muted-foreground">No hay movimientos para estos filtros.</td></tr>}
    </tbody></table></div>
  </div>
}
