'use server';

import { createClient } from '@/lib/supabase/admin';

export async function updateTicketReceipt(
  ticketId: string,
  receiptUrl: string,
  notes?: string
) {
  try {
    console.log('[v0] Server Action - Actualizando ticket con comprobante');
    console.log('[v0] Ticket ID:', ticketId);
    console.log('[v0] Receipt URL:', receiptUrl);
    console.log('[v0] Notes:', notes);

    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('tickets')
      .update({
        payment_receipt_url: receiptUrl,
        payment_notes: notes || null,
        payment_status: "submitted"
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('[v0] Error al actualizar ticket:', error);
      throw new Error(error.message);
    }

    console.log('[v0] Ticket actualizado exitosamente:', data);
    return data;
  } catch (error) {
    console.error('[v0] Error en updateTicketReceipt:', error);
    throw error;
  }
}
