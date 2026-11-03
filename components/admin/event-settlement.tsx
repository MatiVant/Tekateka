'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveEventReconciliation, saveEventSettlement, type EventReconciliation } from '@/app/actions/event-settlement'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Banknote, Check, Plus, ReceiptText, Trash2 } from 'lucide-react'

type Ticket = {
  id: string
  buyer_name?: string | null
  final_price?: number | string | null
  charged_amount?: number | string | null
  payment_method?: string | null
  status?: string | null
  payment_status?: string | null
}
type DoorSale = { id: string; quantity: number; unit_price: number | string; buyer_name?: string | null; buyer_note?: string | null }
type Expense = { name: string; amount: number }
type Settlement = {
  door_paid_count?: number
  door_paid_unit_price?: number
  door_free_count?: number
  artist_percentage?: number
  percentage_basis?: 'gross' | 'net'
  expenses?: Expense[]
  notes?: string | null
  closed_at?: string | null
} | null

const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export function EventSettlement({ eventId, tickets, doorSales, initialSettlement, initialReconciliations }: { eventId: string; tickets: Ticket[]; doorSales: DoorSale[]; initialSettlement: Settlement; initialReconciliations: EventReconciliation[] }) {
  const [reconciliations, setReconciliations] = useState<Record<string, EventReconciliation>>(() => Object.fromEntries(initialReconciliations.map((item) => [`${item.source_type}:${item.source_id}`, item])))
  const [doorPaid, setDoorPaid] = useState(initialSettlement?.door_paid_count ?? 0)
  const [doorPrice, setDoorPrice] = useState(initialSettlement?.door_paid_unit_price ?? 0)
  const [doorFree, setDoorFree] = useState(initialSettlement?.door_free_count ?? 0)
  const [percentage, setPercentage] = useState(initialSettlement?.artist_percentage ?? 70)
  const [basis, setBasis] = useState<'gross' | 'net'>(initialSettlement?.percentage_basis ?? 'gross')
  const [expenses, setExpenses] = useState<Expense[]>(initialSettlement?.expenses ?? [])
  const [notes, setNotes] = useState(initialSettlement?.notes ?? '')
  const [closed, setClosed] = useState(Boolean(initialSettlement?.closed_at))
  const [isPending, startTransition] = useTransition()

  const reconciliationFor = (sourceType: EventReconciliation['source_type'], sourceId: string) => reconciliations[`${sourceType}:${sourceId}`]
  const confirmedTickets = tickets.filter((ticket) => ticket.status !== 'cancelled' && (['approved', 'confirmed'].includes(String(ticket.payment_status)) || ['confirmed', 'used'].includes(String(ticket.status))) && reconciliationFor('ticket', ticket.id)?.status !== 'cancelled')
  const onlineTicketCount = confirmedTickets.length
  const onlineFreeCount = confirmedTickets.filter((ticket) => ticket.payment_method === 'free' || Number(ticket.final_price ?? 0) === 0).length
  // Ventas online es el valor de las entradas; recaudado online es lo efectivamente cobrado.
  const onlineSales = confirmedTickets.reduce((sum, ticket) => sum + Number(reconciliationFor('ticket', ticket.id)?.adjusted_amount ?? ticket.final_price ?? 0), 0)
  const onlineCollected = confirmedTickets.reduce((sum, ticket) => sum + Number(reconciliationFor('ticket', ticket.id)?.adjusted_amount ?? ticket.charged_amount ?? ticket.final_price ?? 0), 0)
  const activeDoorSales = doorSales.filter((sale) => reconciliationFor('door_sale', sale.id)?.status !== 'cancelled')
  const recordedDoorCount = activeDoorSales.reduce((sum, sale) => sum + Number(reconciliationFor('door_sale', sale.id)?.adjusted_quantity ?? sale.quantity) || 0, 0)
  const recordedDoorRevenue = activeDoorSales.reduce((sum, sale) => {
    const reconciliation = reconciliationFor('door_sale', sale.id)
    return sum + Number(reconciliation?.adjusted_quantity ?? sale.quantity) * Number(reconciliation?.adjusted_unit_price ?? sale.unit_price)
  }, 0)
  const doorTicketCount = doorSales.length > 0 ? recordedDoorCount : doorPaid
  const doorRevenue = doorSales.length > 0 ? recordedDoorRevenue : doorPaid * doorPrice
  const totalTicketCount = onlineTicketCount + doorTicketCount + doorFree
  const totalFreeCount = onlineFreeCount + doorFree
  const totalRevenue = onlineCollected + doorRevenue
  const totalExpenses = expenses.reduce((sum, expense) => sum + Math.max(0, Number(expense.amount) || 0), 0)
  const artistAmount = Math.max(0, (basis === 'net' ? totalRevenue - totalExpenses : totalRevenue) * (percentage / 100))
  const organizerAmount = totalRevenue - totalExpenses - artistAmount
  const summary = useMemo(() => ({ onlineSales, onlineCollected, onlineTicketCount, onlineFreeCount, doorRevenue, doorTicketCount, doorFree, totalTicketCount, totalFreeCount, totalRevenue, totalExpenses, artistAmount, organizerAmount }), [onlineSales, onlineCollected, onlineTicketCount, onlineFreeCount, doorRevenue, doorTicketCount, doorFree, totalTicketCount, totalFreeCount, totalRevenue, totalExpenses, artistAmount, organizerAmount])

  const save = () => startTransition(async () => {
    try {
      await saveEventSettlement(eventId, {
        door_paid_count: doorPaid,
        door_paid_unit_price: doorPrice,
        door_free_count: doorFree,
        artist_percentage: percentage,
        percentage_basis: basis,
        expenses,
        notes,
        closed,
      })
      toast.success(closed ? 'Cierre guardado' : 'Resumen guardado')
    } catch {
      toast.error('No se pudo guardar el cierre. Intentá nuevamente.')
    }
  })

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border bg-card shadow-sm" aria-labelledby="event-settlement-title">
      <header className="flex flex-col gap-4 border-b bg-muted/20 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ReceiptText aria-hidden="true" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resumen y liquidación</p>
            <h2 id="event-settlement-title" className="text-2xl font-semibold tracking-tight">Cierre del evento</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Revisá los ingresos, cargá los gastos y dejá listo el balance final.</p>
          </div>
        </div>
        <Badge variant={closed ? 'default' : 'secondary'} className="w-fit rounded-full px-3 py-1">
          {closed ? 'Cierre realizado' : 'Borrador'}
        </Badge>
      </header>

      <div className="space-y-8 p-5 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de liquidación">
          <SummaryCard label="Entradas vendidas" value={String(summary.totalTicketCount)} detail={`${summary.onlineTicketCount} online · ${summary.doorTicketCount} en puerta`} />
          <SummaryCard label="Ventas online" value={money(summary.onlineSales)} detail={`Recaudado online: ${money(summary.onlineCollected)}`} />
          <SummaryCard label="Recaudado en puerta" value={money(summary.doorRevenue)} detail={`${summary.doorTicketCount} pagas`} />
          <SummaryCard label="Entradas gratis" value={String(summary.totalFreeCount)} detail={`${summary.onlineFreeCount ?? 0} online · ${summary.doorFree} en puerta`} />
          <SummaryCard label="Gastos cargados" value={money(summary.totalExpenses)} />
          <SummaryCard label="Total recaudado" value={money(summary.totalRevenue)} detail="Online + puerta, sin descontar gastos" emphasis />
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground"><Banknote aria-hidden="true" /></div>
              <div>
                <h3 className="font-semibold">Ventas en puerta</h3>
                <p className="text-sm text-muted-foreground">Durante el evento, registrá las ventas usando el enlace de la puerta. Completá estos campos solo si necesitás agregar entradas después del show.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="door-paid-count">Entradas pagas</Label>
                <Input id="door-paid-count" type="number" min="0" value={doorPaid} onChange={(event) => setDoorPaid(Number(event.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="door-unit-price">Precio por entrada</Label>
                <Input id="door-unit-price" type="number" min="0" value={doorPrice} onChange={(event) => setDoorPrice(Number(event.target.value))} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="door-free-count">Entradas sin cargo</Label>
                <Input id="door-free-count" type="number" min="0" value={doorFree} onChange={(event) => setDoorFree(Number(event.target.value))} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-5 sm:p-6">
            <h3 className="font-semibold">Liquidación del artista</h3>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">Definí el porcentaje y sobre qué base se calcula.</p>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="artist-percentage">Porcentaje del artista</Label>
                <div className="relative">
                  <Input id="artist-percentage" type="number" min="0" max="100" step="0.5" value={percentage} onChange={(event) => setPercentage(Number(event.target.value))} className="pr-10" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="percentage-basis">Calcular sobre</Label>
                <select id="percentage-basis" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={basis} onChange={(event) => setBasis(event.target.value as 'gross' | 'net')}>
                  <option value="gross">Ingresos brutos</option>
                  <option value="net">Ingresos después de gastos</option>
                </select>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Le corresponde al artista</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-primary">{money(summary.artistAmount)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border p-5 sm:p-6" aria-labelledby="settlement-reconciliation-title">
          <div className="mb-5">
            <h3 id="settlement-reconciliation-title" className="font-semibold">Conciliación de entradas</h3>
            <p className="mt-1 text-sm text-muted-foreground">Revisá entradas anticipadas y ventas de puerta. Las correcciones solo afectan esta rendición; no eliminan entradas ni bajan el evento.</p>
          </div>
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <ReconciliationRow
                key={`ticket-${ticket.id}`}
                eventId={eventId}
                sourceType="ticket"
                sourceId={ticket.id}
                title={ticket.buyer_name || 'Entrada anticipada'}
                detail={`Importe: ${money(Number(ticket.charged_amount ?? ticket.final_price ?? 0))}`}
                originalAmount={Number(ticket.charged_amount ?? ticket.final_price ?? 0)}
                originalBuyerName={ticket.buyer_name ?? ''}
                existing={reconciliationFor('ticket', ticket.id)}
                onSaved={(item) => setReconciliations((current) => ({ ...current, [`ticket:${ticket.id}`]: item }))}
              />
            ))}
            {doorSales.map((sale) => (
              <ReconciliationRow
                key={`door-${sale.id}`}
                eventId={eventId}
                sourceType="door_sale"
                sourceId={sale.id}
                title={sale.buyer_name || 'Venta en puerta'}
                detail={`${sale.quantity} × ${money(Number(sale.unit_price))}`}
                originalQuantity={Number(sale.quantity)}
                originalUnitPrice={Number(sale.unit_price)}
                originalBuyerName={sale.buyer_name ?? ''}
                existing={reconciliationFor('door_sale', sale.id)}
                onSaved={(item) => setReconciliations((current) => ({ ...current, [`door_sale:${sale.id}`]: item }))}
              />
            ))}
            {tickets.length === 0 && doorSales.length === 0 && <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No hay entradas para conciliar.</p>}
          </div>
        </section>

        <section className="rounded-2xl border p-5 sm:p-6" aria-labelledby="settlement-expenses-title">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 id="settlement-expenses-title" className="font-semibold">Gastos del evento</h3>
              <p className="mt-1 text-sm text-muted-foreground">Sonido, producción, seguridad y otros costos.</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-fit rounded-full" onClick={() => setExpenses((current) => [...current, { name: '', amount: 0 }])}>
              <Plus data-icon="inline-start" /> Agregar gasto
            </Button>
          </div>
          {expenses.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Todavía no agregaste gastos.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {expenses.map((expense, index) => (
                <div className="grid gap-3 rounded-xl bg-muted/30 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end" key={`${index}-${expense.name}`}>
                  <div className="grid gap-2">
                    <Label htmlFor={`expense-name-${index}`}>Descripción</Label>
                    <Input id={`expense-name-${index}`} placeholder="Sonido, seguridad…" value={expense.name} onChange={(event) => setExpenses((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`expense-amount-${index}`}>Importe</Label>
                    <Input id={`expense-amount-${index}`} type="number" min="0" placeholder="$ 0" value={expense.amount} onChange={(event) => setExpenses((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) } : item))} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar gasto ${expense.name || index + 1}`} onClick={() => setExpenses((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="settlement-notes">Notas del cierre</Label>
            <Textarea id="settlement-notes" placeholder="Dejá asentado cualquier detalle importante…" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-28 resize-y rounded-xl" />
          </div>
          <div className="flex flex-col justify-between gap-5 rounded-2xl bg-primary/5 p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Parte del artista</p>
                <p className="mt-1 text-xl font-semibold">{money(summary.artistAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resultado productor</p>
                <p className="mt-1 text-xl font-semibold">{money(summary.organizerAmount)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <Label htmlFor="settlement-closed" className="cursor-pointer">Marcar evento como cerrado</Label>
                <p className="mt-1 text-xs text-muted-foreground">Podés volver a editar el resumen más adelante.</p>
              </div>
              <Switch id="settlement-closed" checked={closed} onCheckedChange={setClosed} aria-label="Marcar evento como cerrado" />
            </div>
          </div>
        </section>

        <footer className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Los cambios se guardan en el resumen del evento.</p>
          <Button onClick={save} disabled={isPending} className="w-full rounded-full px-6 sm:w-auto">
            {isPending ? 'Guardando…' : closed ? <><Check data-icon="inline-start" /> Guardar cierre</> : 'Guardar resumen'}
          </Button>
        </footer>
      </div>
    </section>
  )
}

function ReconciliationRow({ eventId, sourceType, sourceId, title, detail, originalAmount, originalQuantity, originalUnitPrice, originalBuyerName, existing, onSaved }: {
  eventId: string
  sourceType: 'ticket' | 'door_sale'
  sourceId: string
  title: string
  detail: string
  originalAmount?: number
  originalQuantity?: number
  originalUnitPrice?: number
  originalBuyerName: string
  existing?: EventReconciliation
  onSaved: (item: EventReconciliation) => void
}) {
  const [observation, setObservation] = useState(existing?.observation ?? '')
  const [reason, setReason] = useState(existing?.action_reason ?? '')
  const [amount, setAmount] = useState(String(existing?.adjusted_amount ?? originalAmount ?? ''))
  const [quantity, setQuantity] = useState(String(existing?.adjusted_quantity ?? originalQuantity ?? ''))
  const [unitPrice, setUnitPrice] = useState(String(existing?.adjusted_unit_price ?? originalUnitPrice ?? ''))
  const [buyerName, setBuyerName] = useState(existing?.adjusted_buyer_name ?? originalBuyerName)
  const [isPending, startTransition] = useTransition()

  const save = (status: 'reviewed' | 'modified' | 'cancelled') => startTransition(async () => {
    try {
      if ((status === 'modified' || status === 'cancelled') && !reason.trim()) {
        toast.error(`Ingresá el motivo de ${status === 'modified' ? 'la modificación' : 'la cancelación'}.`)
        return
      }
      await saveEventReconciliation(eventId, {
        sourceType,
        sourceId,
        status,
        observation,
        actionReason: reason,
        adjustedAmount: sourceType === 'ticket' && amount.trim() ? Number(amount) : null,
        adjustedQuantity: sourceType === 'door_sale' && quantity.trim() ? Number(quantity) : null,
        adjustedUnitPrice: sourceType === 'door_sale' && unitPrice.trim() ? Number(unitPrice) : null,
        adjustedBuyerName: buyerName,
      })
      const updated: EventReconciliation = {
        id: existing?.id ?? sourceId,
        event_id: eventId,
        source_type: sourceType,
        source_id: sourceId,
        status,
        observation: observation.trim() || null,
        action_reason: reason.trim() || null,
        adjusted_quantity: sourceType === 'door_sale' && quantity.trim() ? Number(quantity) : null,
        adjusted_unit_price: sourceType === 'door_sale' && unitPrice.trim() ? Number(unitPrice) : null,
        adjusted_amount: sourceType === 'ticket' && amount.trim() ? Number(amount) : null,
        adjusted_buyer_name: buyerName.trim() || null,
        updated_at: new Date().toISOString(),
      }
      onSaved(updated)
      toast.success(status === 'cancelled' ? 'Entrada excluida de la rendición' : status === 'modified' ? 'Corrección guardada' : 'Observación guardada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la conciliación.')
    }
  })

  const statusLabel = existing?.status === 'cancelled' ? 'Cancelada en conciliación' : existing?.status === 'modified' ? 'Modificada' : existing ? 'Revisada' : 'Sin revisar'
  return (
    <article className={`rounded-xl border p-4 ${existing?.status === 'cancelled' ? 'border-destructive/30 bg-destructive/5' : existing?.status === 'modified' ? 'border-amber-300 bg-amber-50/50' : 'bg-muted/20'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{title}</p><Badge variant={existing?.status === 'cancelled' ? 'destructive' : 'outline'}>{statusLabel}</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
          {sourceType === 'ticket' ? <div className="grid gap-1"><Label htmlFor={`reconciliation-amount-${sourceId}`}>Importe conciliado</Label><Input id={`reconciliation-amount-${sourceId}`} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div> : <><div className="grid gap-1"><Label htmlFor={`reconciliation-quantity-${sourceId}`}>Cantidad</Label><Input id={`reconciliation-quantity-${sourceId}`} type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><div className="grid gap-1"><Label htmlFor={`reconciliation-price-${sourceId}`}>Precio unitario</Label><Input id={`reconciliation-price-${sourceId}`} type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /></div></>}
          <div className="grid gap-1 sm:col-span-2"><Label htmlFor={`reconciliation-name-${sourceId}`}>Nombre corregido (opcional)</Label><Input id={`reconciliation-name-${sourceId}`} value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder={originalBuyerName || 'Sin nombre'} /></div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="grid gap-1"><Label htmlFor={`reconciliation-observation-${sourceId}`}>Observación</Label><Textarea id={`reconciliation-observation-${sourceId}`} value={observation} onChange={(event) => setObservation(event.target.value)} rows={2} placeholder="Anotá una aclaración…" /></div>
        <div className="grid gap-1"><Label htmlFor={`reconciliation-reason-${sourceId}`}>Motivo de modificación o cancelación</Label><Textarea id={`reconciliation-reason-${sourceId}`} value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="Obligatorio para modificar o cancelar" /></div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => save('reviewed')} disabled={isPending}>Guardar observación</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => save('modified')} disabled={isPending}>Guardar modificación</Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => save('cancelled')} disabled={isPending}>{existing?.status === 'cancelled' ? 'Actualizar cancelación' : 'Cancelar en rendición'}</Button>
      </div>
    </article>
  )
}

function SummaryCard({ label, value, detail, emphasis = false }: { label: string; value: string; detail?: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? 'border-primary/20 bg-primary/5' : 'bg-card'}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-semibold tracking-tight ${emphasis ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}
