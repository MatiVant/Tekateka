'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function requestOwnershipTransfer(eventId: string, targetEmail: string) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      throw new Error('No autenticado')
    }

    // Verificar que sea el dueño del evento
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, organizer_id, title')
      .eq('id', eventId)
      .eq('organizer_id', currentUser.id)
      .single()

    if (eventError || !event) {
      throw new Error('Evento no encontrado o no tienes permisos')
    }

    // Buscar el usuario objetivo por email usando admin client
    const { data: { users: targetUsers } } = await adminSupabase.auth.admin.listUsers()
    const targetUser = targetUsers.find(u => u.email === targetEmail)

    if (!targetUser) {
      throw new Error('Usuario con ese email no existe')
    }

    if (targetUser.id === currentUser.id) {
      throw new Error('No puedes transferir a ti mismo')
    }

    // Verificar si ya hay una transferencia pendiente
    const { data: existingTransfer } = await supabase
      .from('event_ownership_transfers')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .single()

    if (existingTransfer) {
      throw new Error('Ya existe una solicitud pendiente para este evento')
    }

    // Crear la solicitud de transferencia
    const { error: createError } = await supabase
      .from('event_ownership_transfers')
      .insert({
        event_id: eventId,
        current_owner_id: currentUser.id,
        proposed_owner_id: targetUser.id,
        proposed_owner_email: targetEmail,
      })

    if (createError) throw createError

    revalidatePath(`/admin/events/${eventId}`)
    return { success: true, message: 'Solicitud de transferencia creada' }
  } catch (error) {
    console.error('[v0] Error requesting ownership transfer:', error)
    throw error
  }
}

export async function acceptOwnershipTransfer(transferId: string) {
  try {
    const supabase = await createClient()

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      throw new Error('No autenticado')
    }

    // Obtener la solicitud de transferencia
    const { data: transfer, error: fetchError } = await supabase
      .from('event_ownership_transfers')
      .select('*')
      .eq('id', transferId)
      .eq('proposed_owner_id', currentUser.id)
      .eq('status', 'pending')
      .single()

    if (fetchError || !transfer) {
      throw new Error('Solicitud no encontrada')
    }

    // Actualizar la transferencia
    const { error: updateTransferError } = await supabase
      .from('event_ownership_transfers')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
      })
      .eq('id', transferId)

    if (updateTransferError) throw updateTransferError

    // Actualizar el dueño del evento
    const { error: updateEventError } = await supabase
      .from('events')
      .update({ organizer_id: currentUser.id })
      .eq('id', transfer.event_id)

    if (updateEventError) throw updateEventError

    revalidatePath('/admin')
    revalidatePath(`/admin/events/${transfer.event_id}`)
    return { success: true, message: 'Transferencia aceptada' }
  } catch (error) {
    console.error('[v0] Error accepting ownership transfer:', error)
    throw error
  }
}

export async function rejectOwnershipTransfer(transferId: string) {
  try {
    const supabase = await createClient()

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      throw new Error('No autenticado')
    }

    // Obtener la solicitud de transferencia
    const { data: transfer, error: fetchError } = await supabase
      .from('event_ownership_transfers')
      .select('*')
      .eq('id', transferId)
      .eq('proposed_owner_id', currentUser.id)
      .eq('status', 'pending')
      .single()

    if (fetchError || !transfer) {
      throw new Error('Solicitud no encontrada')
    }

    // Actualizar la transferencia
    const { error: updateError } = await supabase
      .from('event_ownership_transfers')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
      })
      .eq('id', transferId)

    if (updateError) throw updateError

    revalidatePath('/admin')
    return { success: true, message: 'Transferencia rechazada' }
  } catch (error) {
    console.error('[v0] Error rejecting ownership transfer:', error)
    throw error
  }
}

export async function cancelOwnershipTransfer(transferId: string) {
  try {
    const supabase = await createClient()

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      throw new Error('No autenticado')
    }

    // Obtener la solicitud de transferencia
    const { data: transfer, error: fetchError } = await supabase
      .from('event_ownership_transfers')
      .select('*')
      .eq('id', transferId)
      .eq('current_owner_id', currentUser.id)
      .eq('status', 'pending')
      .single()

    if (fetchError || !transfer) {
      throw new Error('Solicitud no encontrada')
    }

    // Actualizar la transferencia
    const { error: updateError } = await supabase
      .from('event_ownership_transfers')
      .update({
        status: 'cancelled',
        responded_at: new Date().toISOString(),
      })
      .eq('id', transferId)

    if (updateError) throw updateError

    revalidatePath(`/admin/events/${transfer.event_id}`)
    return { success: true, message: 'Solicitud de transferencia cancelada' }
  } catch (error) {
    console.error('[v0] Error cancelling ownership transfer:', error)
    throw error
  }
}

export async function getPendingTransfers() {
  try {
    const supabase = await createClient()

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      throw new Error('No autenticado')
    }

    const { data: transfers, error } = await supabase
      .from('event_ownership_transfers')
      .select(`
        *,
        events:event_id(id, title, event_date)
      `)
      .eq('proposed_owner_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error

    return transfers || []
  } catch (error) {
    console.error('[v0] Error fetching pending transfers:', error)
    throw error
  }
}
