'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { createClient as createAdminClient } from '@/lib/supabase/admin'

export async function createDoorSale(eventId: string, input: { quantity: number; unitPrice: number; buyerName?: string; note?: string }) {
  const { authorized, user, profile } = await requireAuth(['organizer', 'superadmin'])
  if (!authorized || !user) throw new Error('No autorizado')
  const supabase = createAdminClient()
  const eventQuery = supabase.from('events').select('id, organizer_id').eq('id', eventId)
  const { data: event } = profile?.role === 'superadmin' ? await eventQuery.single() : await eventQuery.eq('organizer_id', user.id).single()
  if (!event) throw new Error('Evento no encontrado')
  const quantity = Math.floor(Number(input.quantity))
  const unitPrice = Math.round(Number(input.unitPrice) * 100) / 100
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('La cantidad debe estar entre 1 y 1.000')
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('El precio no es válido')
  const { error } = await supabase.from('door_sales').insert({ event_id: eventId, quantity, unit_price: unitPrice, buyer_name: input.buyerName?.trim().slice(0, 120) || null, buyer_note: input.note?.trim().slice(0, 500) || null, created_by: user.id })
  if (error) throw new Error(error.message)
  revalidatePath(`/verify?event=${eventId}`)
  revalidatePath(`/admin/events/${eventId}/tickets`)
}

export async function getDoorSales(eventId: string) {
  const { authorized, user, profile } = await requireAuth(['organizer', 'superadmin'])
  if (!authorized || !user) return []
  const supabase = createAdminClient()
  const eventQuery = supabase.from('events').select('id, organizer_id').eq('id', eventId)
  const { data: event } = profile?.role === 'superadmin' ? await eventQuery.single() : await eventQuery.eq('organizer_id', user.id).single()
  if (!event) return []
  const { data } = await supabase.from('door_sales').select('*').eq('event_id', eventId).order('created_at', { ascending: false })
  return data ?? []
}
