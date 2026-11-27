'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createUniqueEventSlug } from '@/lib/slugify'
import { APPROVAL_DISABLED_MESSAGE, isMissingApprovalColumn } from '@/lib/ticket-approval'

interface EventData {
  title: string
  description: string | null
  audience_tags: string[]
  audience_keywords: string
  event_date: string
  venue: string
  venue_id: string | null
  location_url: string | null
  price: number
  door_ticket_price: number | null
  is_pay_what_you_want: boolean
  requires_approval?: boolean
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

    const audienceTags = Array.from(new Set((eventData.audience_tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)))
    if (!eventId && audienceTags.length < 3) {
      throw new Error('Cada evento nuevo debe tener al menos 3 estilos seleccionados')
    }

    const slug = await createUniqueEventSlug(supabase, eventData.title, eventId)

    const hasTiersInPayload = ticketTiers.length > 0
    let hasTicketTiers = hasTiersInPayload
    if (eventId && !hasTicketTiers) {
      const { count: ticketTierCount, error: ticketTiersError } = await supabase
        .from('ticket_tiers')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
      if (ticketTiersError) throw ticketTiersError
      hasTicketTiers = (ticketTierCount ?? 0) > 0
    }

    const parsedPrice = Number(eventData.price)
    const priceIsValid = Number.isFinite(parsedPrice) && parsedPrice >= 0
    if (!priceIsValid && !hasTicketTiers) {
      throw new Error('El precio de la entrada es obligatorio')
    }

    if (eventId) {
      const { data: existingEvent, error: existingEventError } = await supabase
        .from('events')
        .select('id, organizer_id, total_tickets, available_tickets, price')
        .eq('id', eventId)
        .eq('organizer_id', user.id)
        .single()
      if (existingEventError || !existingEvent) throw new Error('No tenés permiso para editar este evento')

      if (!priceIsValid && hasTicketTiers) {
        eventData.price = Number(existingEvent.price ?? 0)
      }

      const [{ count: reservedTickets, error: ticketsError }, { data: doorSales, error: doorSalesError }] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId).in('status', ['pending', 'confirmed', 'used']),
        supabase.from('door_sales').select('quantity').eq('event_id', eventId),
      ])
      if (ticketsError || doorSalesError) throw ticketsError || doorSalesError
      const doorTicketCount = (doorSales ?? []).reduce((total, sale) => total + Number(sale.quantity ?? 0), 0)
      const occupiedTickets = Number(reservedTickets ?? 0) + doorTicketCount
      const requestedTotal = Math.floor(Number(eventData.total_tickets))
      if (!Number.isInteger(requestedTotal) || requestedTotal < 1) throw new Error('La cantidad total de entradas no es válida')
      if (requestedTotal < occupiedTickets) {
        throw new Error(`No podés establecer menos de ${occupiedTickets} entradas: ya hay esa cantidad reservada o vendida.`)
      }

      const updatePayload = {
        ...eventData,
        total_tickets: requestedTotal,
        available_tickets: requestedTotal - occupiedTickets,
        slug,
      }
      const runUpdate = (payload: Record<string, unknown>) =>
        supabase.from('events').update(payload).eq('id', eventId).eq('organizer_id', user.id)

      let { error: updateError } = await runUpdate(updatePayload)
      if (isMissingApprovalColumn(updateError)) {
        // Falta correr el script 050: se guarda igual, salvo que se pida aprobación.
        if (eventData.requires_approval) throw new Error(APPROVAL_DISABLED_MESSAGE)
        const withoutApproval = Object.fromEntries(Object.entries(updatePayload).filter(([key]) => key !== 'requires_approval'))
        ;({ error: updateError } = await runUpdate(withoutApproval))
      }

      if (updateError) throw updateError

      revalidatePath('/admin')
      revalidatePath(`/events/${eventId}`)
      return { success: true, eventId }
    } else {
      if (!priceIsValid && hasTicketTiers) {
        const tierPrices = ticketTiers
          .map((tier) => Number(tier.base_price))
          .filter((tierPrice) => Number.isFinite(tierPrice) && tierPrice >= 0)
        eventData.price = tierPrices.length > 0 ? Math.min(...tierPrices) : 0
      }

      // Crear nuevo evento
      const insertPayload = { ...eventData, slug }
      let { data: newEvent, error: insertError } = await supabase.from('events').insert(insertPayload).select().single()
      if (isMissingApprovalColumn(insertError)) {
        // Falta correr el script 050: se crea igual, salvo que se pida aprobación.
        if (eventData.requires_approval) throw new Error(APPROVAL_DISABLED_MESSAGE)
        const withoutApproval = Object.fromEntries(Object.entries(insertPayload).filter(([key]) => key !== 'requires_approval'))
        ;({ data: newEvent, error: insertError } = await supabase.from('events').insert(withoutApproval).select().single())
      }

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
