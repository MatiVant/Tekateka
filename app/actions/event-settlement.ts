'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { createClient as createAdminClient } from '@/lib/supabase/admin'

export type SettlementInput = {
  door_paid_count: number
  door_paid_unit_price: number
  door_free_count: number
  door_two_for_one_count: number
  artist_percentage: number
  percentage_basis: 'gross' | 'net'
  expenses: Array<{ name: string; amount: number }>
  notes: string
  closed: boolean
}

export async function saveEventSettlement(eventId: string, input: SettlementInput) {
  const { authorized, user, profile } = await requireAuth(['organizer'])
  if (!authorized || !user) throw new Error('No autorizado')
  const supabase = createAdminClient()
  const eventQuery = supabase.from('events').select('id, organizer_id').eq('id', eventId)
  const { data: event } = profile?.role === 'superadmin' ? await eventQuery.single() : await eventQuery.eq('organizer_id', user.id).single()
  if (!event) throw new Error('Evento no encontrado')

  const cleanExpenses = input.expenses.filter((expense) => expense.name.trim() && Number.isFinite(expense.amount) && expense.amount >= 0).map((expense) => ({ name: expense.name.trim().slice(0, 80), amount: Math.round(expense.amount * 100) / 100 }))
  const { error } = await supabase.from('event_settlements').upsert({
    event_id: eventId,
    door_paid_count: Math.max(0, Math.floor(input.door_paid_count)),
    door_paid_unit_price: Math.max(0, input.door_paid_unit_price),
    door_free_count: Math.max(0, Math.floor(input.door_free_count)),
    door_two_for_one_count: Math.max(0, Math.floor(input.door_two_for_one_count)),
    artist_percentage: Math.min(100, Math.max(0, input.artist_percentage)),
    percentage_basis: input.percentage_basis,
    expenses: cleanExpenses,
    notes: input.notes.trim().slice(0, 2000) || null,
    closed_at: input.closed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_id' })
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/tickets`)
}

export async function getEventSettlement(eventId: string) {
  const { authorized, user, profile } = await requireAuth(['organizer'])
  if (!authorized || !user) return null
  const supabase = createAdminClient()
  const eventQuery = supabase.from('events').select('id, organizer_id').eq('id', eventId)
  const { data: event } = profile?.role === 'superadmin' ? await eventQuery.single() : await eventQuery.eq('organizer_id', user.id).single()
  if (!event) return null
  const { data } = await supabase.from('event_settlements').select('*').eq('event_id', eventId).maybeSingle()
  return data
}
