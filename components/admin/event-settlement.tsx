'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveEventSettlement } from '@/app/actions/event-settlement'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Banknote, Check, Plus, ReceiptText, Trash2 } from 'lucide-react'

type Ticket = { final_price?: number | string | null; payment_status?: string | null }
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

export function EventSettlement({ eventId, tickets, initialSettlement }: { eventId: string; tickets: Ticket[]; initialSettlement: Settlement }) {
  const [doorPaid, setDoorPaid] = useState(initialSettlement?.door_paid_count ?? 0)
  const [doorPrice, setDoorPrice] = useState(initialSettlement?.door_paid_unit_price ?? 0)
  const [doorFree, setDoorFree] = useState(initialSettlement?.door_free_count ?? 0)
  const [percentage, setPercentage] = useState(initialSettlement?.artist_percentage ?? 70)
  const [basis, setBasis] = useState<'gross' | 'net'>(initialSettlement?.percentage_basis ?? 'gross')
  const [expenses, setExpenses] = useState<Expense[]>(initialSettlement?.expenses ?? [])
  const [notes, setNotes] = useState(initialSettlement?.notes ?? '')
  const [closed, setClosed] = useState(Boolean(initialSettlement?.closed_at))
  const [isPending, startTransition] = useTransition()

  const onlineRevenue = tickets.reduce((sum, ticket) => sum + (['approved', 'confirmed'].includes(String(ticket.payment_status)) ? Number(ticket.final_price || 0) : 0), 0)
  const doorRevenue = doorPaid * doorPrice
  const totalRevenue = onlineRevenue + doorRevenue
  const totalExpenses = expenses.reduce((sum, expense) => sum + Math.max(0, Number(expense.amount) || 0), 0)
  const artistAmount = Math.max(0, (basis === 'net' ? totalRevenue - totalExpenses : totalRevenue) * (percentage / 100))
  const organizerAmount = totalRevenue - totalExpenses - artistAmount
  const summary = useMemo(() => ({ onlineRevenue, doorRevenue, totalRevenue, totalExpenses, artistAmount, organizerAmount }), [onlineRevenue, doorRevenue, totalRevenue, totalExpenses, artistAmount, organizerAmount])

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
          <SummaryCard label="Ventas online" value={money(summary.onlineRevenue)} />
          <SummaryCard label="Recaudado en puerta" value={money(summary.doorRevenue)} />
          <SummaryCard label="Gastos cargados" value={money(summary.totalExpenses)} />
          <SummaryCard label="Total recaudado" value={money(summary.totalRevenue)} emphasis />
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground"><Banknote aria-hidden="true" /></div>
              <div>
                <h3 className="font-semibold">Ventas en puerta</h3>
                <p className="text-sm text-muted-foreground">Completá solo lo vendido o entregado presencialmente.</p>
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

function SummaryCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? 'border-primary/20 bg-primary/5' : 'bg-card'}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-semibold tracking-tight ${emphasis ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}
