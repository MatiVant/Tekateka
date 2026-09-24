'use client'

import { useMemo, useState, useTransition } from 'react'
import { saveEventSettlement } from '@/app/actions/event-settlement'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Ticket = { final_price?: number | string | null; payment_status?: string | null }
type Expense = { name: string; amount: number }
type Settlement = { door_paid_count?: number; door_paid_unit_price?: number; door_free_count?: number; door_two_for_one_count?: number; artist_percentage?: number; percentage_basis?: 'gross' | 'net'; expenses?: Expense[]; notes?: string | null; closed_at?: string | null } | null

const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export function EventSettlement({ eventId, tickets, initialSettlement }: { eventId: string; tickets: Ticket[]; initialSettlement: Settlement }) {
  const [doorPaid, setDoorPaid] = useState(initialSettlement?.door_paid_count ?? 0)
  const [doorPrice, setDoorPrice] = useState(initialSettlement?.door_paid_unit_price ?? 0)
  const [doorFree, setDoorFree] = useState(initialSettlement?.door_free_count ?? 0)
  const [twoForOne, setTwoForOne] = useState(initialSettlement?.door_two_for_one_count ?? 0)
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
    await saveEventSettlement(eventId, { door_paid_count: doorPaid, door_paid_unit_price: doorPrice, door_free_count: doorFree, door_two_for_one_count: twoForOne, artist_percentage: percentage, percentage_basis: basis, expenses, notes, closed })
  })

  return <Card className="mt-6 border-primary/20"><CardHeader><CardTitle>Cierre del evento</CardTitle><CardDescription>Completá el resumen final de ventas, puerta, gastos y liquidación del artista.</CardDescription></CardHeader><CardContent className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><Label>Entradas pagas en puerta</Label><Input type="number" min="0" value={doorPaid} onChange={(e) => setDoorPaid(Number(e.target.value))} /></div><div><Label>Precio unitario puerta</Label><Input type="number" min="0" value={doorPrice} onChange={(e) => setDoorPrice(Number(e.target.value))} /></div><div><Label>Ingresos sin pagar</Label><Input type="number" min="0" value={doorFree} onChange={(e) => setDoorFree(Number(e.target.value))} /></div><div><Label>Entradas 2x1</Label><Input type="number" min="0" value={twoForOne} onChange={(e) => setTwoForOne(Number(e.target.value))} /></div></div>
    <div className="grid gap-4 sm:grid-cols-3"><div><Label>Porcentaje artista</Label><Input type="number" min="0" max="100" step="0.5" value={percentage} onChange={(e) => setPercentage(Number(e.target.value))} /></div><div><Label>Aplicar sobre</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={basis} onChange={(e) => setBasis(e.target.value as 'gross' | 'net')}><option value="gross">Ingresos brutos</option><option value="net">Neto después de gastos</option></select></div><div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />Marcar como cerrado</label></div></div>
    <div className="space-y-3"><div className="flex items-center justify-between"><Label>Gastos</Label><Button type="button" variant="outline" size="sm" onClick={() => setExpenses([...expenses, { name: '', amount: 0 }])}>Agregar gasto</Button></div>{expenses.map((expense, index) => <div className="flex gap-2" key={index}><Input placeholder="Sonido, seguridad..." value={expense.name} onChange={(e) => setExpenses(expenses.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /><Input type="number" min="0" placeholder="Importe" value={expense.amount} onChange={(e) => setExpenses(expenses.map((item, i) => i === index ? { ...item, amount: Number(e.target.value) } : item))} /><Button type="button" variant="ghost" onClick={() => setExpenses(expenses.filter((_, i) => i !== index))}>Quitar</Button></div>)}</div>
    <Textarea placeholder="Notas del cierre" value={notes} onChange={(e) => setNotes(e.target.value)} />
    <div className="grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Total recaudado</p><p className="text-xl font-bold">{money(summary.totalRevenue)}</p></div><div><p className="text-xs text-muted-foreground">Le corresponde al artista</p><p className="text-xl font-bold text-primary">{money(summary.artistAmount)}</p></div><div><p className="text-xs text-muted-foreground">Resultado productor</p><p className="text-xl font-bold">{money(summary.organizerAmount)}</p></div></div>
    <Button onClick={save} disabled={isPending}>{isPending ? 'Guardando...' : closed ? 'Guardar cierre' : 'Guardar resumen'}</Button>
  </CardContent></Card>
}
