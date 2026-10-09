'use client'

import { useState, useTransition } from 'react'
import { createDoorSale } from '@/app/actions/door-sales'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function DoorSaleForm({ eventId }: { eventId?: string }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [note, setNote] = useState('')

  if (!eventId) return null
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')
    startTransition(async () => {
      try {
        await createDoorSale(eventId, { quantity: Number(quantity), unitPrice: Number(unitPrice), buyerName, note })
        setMessage('Venta en puerta registrada.')
        setQuantity('1'); setBuyerName(''); setNote('')
      } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar la venta.') }
    })
  }

  return <Card className="mt-6"><CardHeader><CardTitle>Venta en puerta</CardTitle><CardDescription>Registrá un lote cobrado en efectivo. No genera QR.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="door-quantity">Cantidad</Label><Input id="door-quantity" type="number" min="1" max="1000" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="door-price">Precio por entrada</Label><Input id="door-price" type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="door-name">Nombre (opcional)</Label><Input id="door-name" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} maxLength={120} /></div><div className="space-y-2"><Label htmlFor="door-note">Nota (opcional)</Label><Input id="door-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></div><div className="sm:col-span-2 flex items-center gap-3"><Button type="submit" disabled={isPending}>{isPending ? 'Guardando…' : 'Registrar venta'}</Button>{message && <p className="text-sm text-muted-foreground">{message}</p>}</div></form></CardContent></Card>
}
