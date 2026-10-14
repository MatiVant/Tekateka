'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createUniqueEventSlug } from '@/lib/slugify'

interface EventData {
  title: string
  description: string | null
  audience_tags: string[]
  audience_keywords: string
  event_date: string
  venue: string
  location_url: string | null
  price: number
  door_ticket_price: number | null
  is_pay_what_you_want: boolean
  total_tickets: number
  available_tickets: number
  image_url: string | null
  image_position_x: number
  image_position_y: number
  status: string
  organizer_id: string
  max_tickets_per_person: number | null
  mercado_pago_link: string | null
  payment_methods: string[]
  transfer_alias: string | null
  transfer_account_holder: string | null
  sales_start_at: string | null
  sales_end_at: string | null
}

interface TicketTier {
  event_id?: string
  name: string
  description: string | null
  base_price: number
  quantity: number
  available_quantity: number
  tier_order: number
  sales_start_at?: string | null
  sales_end_at?: string | null
  promotion_type?: "standard" | "2x1"
}

function databaseError(operation: string, error: unknown) {
  if (error && typeof error === 'object') {
    const databaseError = error as { code?: string; details?: string | null; hint?: string | null; message?: string }
    const parts = [
      databaseError.message,
      databaseError.code ? `Código: ${databaseError.code}` : null,
      databaseError.details ? `Detalles: ${databaseError.details}` : null,
      databaseError.hint ? `Ayuda: ${databaseError.hint}` : null,
    ].filter(Boolean)

    if (parts.length > 0) return new Error(`${operation}: ${parts.join(' — ')}`)
  }

  return error instanceof Error ? error : new Error(`${operation}: Error desconocido`)
}

export async function saveEvent(
  eventData: EventData,
  ticketTiers: TicketTier[],
  eventId?: string
) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Usuario no autenticado')
    }

    // Verificar que el usuario sea el organizador
    if (eventData.organizer_id !== user.id) {
      throw new Error('No tienes permiso para crear eventos en nombre de otro usuario')
    }

    if (!eventData.image_url || !eventData.image_url.startsWith('https://')) {
      throw new Error('La imagen del evento es obligatoria y debe haberse subido correctamente')
    }

    const slug = await createUniqueEventSlug(supabase, eventData.title, eventId)

    if (eventId) {
      const { data: existingEvent, error: existingEventError } = await supabase
        .from('events')
        .select('id, organizer_id, total_tickets, available_tickets')
        .eq('id', eventId)
        .eq('organizer_id', user.id)
        .single()
      if (existingEventError || !existingEvent) throw new Error('No tenés permiso para editar este evento')

      const { error: updateError } = await supabase
        .from('events')
        .update({
          ...eventData,
          total_tickets: existingEvent.total_tickets,
          available_tickets: existingEvent.available_tickets,
          slug,
        })
        .eq('id', eventId)
        .eq('organizer_id', user.id)

      if (updateError) throw updateError

      revalidatePath('/admin')
      revalidatePath(`/events/${eventId}`)
      return { success: true, eventId }
    } else {
      // Crear nuevo evento
      const { data: newEvent, error: insertError } = await supabase
        .from('events')
        .insert({ ...eventData, slug })
        .select()
        .single()

      if (insertError) throw insertError

      // Crear tipos de entradas si existen
      if (ticketTiers.length > 0 && newEvent) {
        const tiersToInsert = ticketTiers.map((tier) => ({
          ...tier,
          event_id: newEvent.id,
        }))

        const { error: tiersError } = await supabase.from('ticket_tiers').insert(tiersToInsert)
        if (tiersError) throw tiersError
      }

      revalidatePath('/admin')
      revalidatePath('/')
      return { success: true, eventId: newEvent.id }
    }
  } catch (error) {
    const normalizedError = databaseError('No se pudo guardar el evento', error)
    console.error('[v0] Error al guardar evento:', error)
    throw normalizedError
  }
}
