'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface EventData {
  title: string
  description: string | null
  event_date: string
  venue: string
  location_url: string | null
  price: number
  is_pay_what_you_want: boolean
  total_tickets: number
  available_tickets: number
  image_url: string | null
  status: string
  organizer_id: string
  max_tickets_per_person: number | null
  mercado_pago_link: string | null
}

interface TicketTier {
  event_id?: string
  name: string
  description: string | null
  base_price: number
  quantity: number
  available_quantity: number
  tier_order: number
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

    if (eventId) {
      // Actualizar evento existente
      const { error: updateError } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', eventId)

      if (updateError) throw updateError

      revalidatePath('/admin')
      revalidatePath(`/events/${eventId}`)
      return { success: true, eventId }
    } else {
      // Crear nuevo evento
      const { data: newEvent, error: insertError } = await supabase
        .from('events')
        .insert(eventData)
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
    console.error('[v0] Error al guardar evento:', error)
    throw error
  }
}
