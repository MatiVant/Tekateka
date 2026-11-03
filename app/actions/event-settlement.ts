'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { createClient as createAdminClient } from '@/lib/supabase/admin'

export type SettlementInput = {
  door_paid_count: number
  door_paid_unit_price: number
  door_free_count: number
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

async function getAuthorizedEvent(eventId: string) {
  const { authorized, user, profile } = await requireAuth(['organizer'])
  if (!authorized || !user) return null
  const supabase = createAdminClient()
  const eventQuery = supabase.from('events').select('id, organizer_id').eq('id', eventId)
  const { data: event } = profile?.role === 'superadmin' ? await eventQuery.single() : await eventQuery.eq('organizer_id', user.id).single()
  return event ? { event, user, supabase } : null
}

export async function getEventSettlement(eventId: string) {
  const authorizedEvent = await getAuthorizedEvent(eventId)
  if (!authorizedEvent) return null
  const { data } = await authorizedEvent.supabase.from('event_settlements').select('*').eq('event_id', eventId).maybeSingle()
  return data
}

export type EventReconciliation = {
  id: string
  event_id: string
  source_type: 'ticket' | 'door_sale'
  source_id: string
  status: 'reviewed' | 'modified' | 'cancelled'
  observation: string | null
  action_reason: string | null
  adjusted_quantity: number | null
  adjusted_unit_price: number | null
  adjusted_amount: number | null
  adjusted_buyer_name: string | null
  updated_at: string
}

export async function getEventReconciliations(eventId: string): Promise<EventReconciliation[]> {
  const authorizedEvent = await getAuthorizedEvent(eventId)
  if (!authorizedEvent) return []
  const { data, error } = await authorizedEvent.supabase.from('event_reconciliations').select('*').eq('event_id', eventId)
  if (error) throw new Error(error.message)
  return (data ?? []) as EventReconciliation[]
}

export type ReconciliationInput = {
  sourceType: 'ticket' | 'door_sale'
  sourceId: string
  status: 'reviewed' | 'modified' | 'cancelled'
  observation?: string
  actionReason?: string
  adjustedQuantity?: number | null
  adjustedUnitPrice?: number | null
  adjustedAmount?: number | null
  adjustedBuyerName?: string | null
}

export async function saveEventReconciliation(eventId: string, input: ReconciliationInput) {
  const authorizedEvent = await getAuthorizedEvent(eventId)
  if (!authorizedEvent) throw new Error('Evento no encontrado')
  if (!['ticket', 'door_sale'].includes(input.sourceType)) throw new Error('Origen inválido')
  if (!['reviewed', 'modified', 'cancelled'].includes(input.status)) throw new Error('Estado inválido')
  if (!input.sourceId || input.sourceId.length > 100) throw new Error('Entrada inválida')
  if (input.status === 'cancelled' && !input.actionReason?.trim()) throw new Error('El motivo de cancelación es obligatorio')
  if (input.status === 'modified' && !input.actionReason?.trim()) throw new Error('El motivo de modificación es obligatorio')

  const sourceTable = input.sourceType === 'ticket' ? 'tickets' : 'door_sales'
  const { data: sourceRecord, error: sourceError } = await authorizedEvent.supabase.from(sourceTable).select('id').eq('id', input.sourceId).eq('event_id', eventId).maybeSingle()
  if (sourceError || !sourceRecord) throw new Error('La entrada no pertenece a este evento')

  const adjustedQuantity = input.adjustedQuantity == null ? null : Math.floor(Number(input.adjustedQuantity))
  const adjustedUnitPrice = input.adjustedUnitPrice == null ? null : Math.round(Number(input.adjustedUnitPrice) * 100) / 100
  const adjustedAmount = input.adjustedAmount == null ? null : Math.round(Number(input.adjustedAmount) * 100) / 100
  if (adjustedQuantity !== null && (!Number.isInteger(adjustedQuantity) || adjustedQuantity < 1)) throw new Error('La cantidad corregida no es válida')
  if (adjustedUnitPrice !== null && (!Number.isFinite(adjustedUnitPrice) || adjustedUnitPrice < 0)) throw new Error('El precio corregido no es válido')
  if (adjustedAmount !== null && (!Number.isFinite(adjustedAmount) || adjustedAmount < 0)) throw new Error('El importe corregido no es válido')

  const { error } = await authorizedEvent.supabase.from('event_reconciliations').upsert({
    event_id: eventId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    status: input.status,
    observation: input.observation?.trim().slice(0, 1000) || null,
    action_reason: input.actionReason?.trim().slice(0, 500) || null,
    adjusted_quantity: adjustedQuantity,
    adjusted_unit_price: adjustedUnitPrice,
    adjusted_amount: adjustedAmount,
    adjusted_buyer_name: input.adjustedBuyerName?.trim().slice(0, 120) || null,
    created_by: authorizedEvent.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_id,source_type,source_id' })
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/tickets`)
}
