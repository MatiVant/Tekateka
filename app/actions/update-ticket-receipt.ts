'use server';

import { createClient } from '@/lib/supabase/admin';
import { redactForLog } from '@/lib/mask-personal-data';

export async function updateTicketReceipt(
  ticketId: string,
  receiptUrl: string,
  notes?: string
) {
  try {
    console.log("[v0] Server Action - Actualizando ticket con comprobante", { ticketId })

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
      console.error("[v0] Error al actualizar ticket:", redactForLog(error))
      throw new Error(error.message);
    }

    console.log("[v0] Ticket actualizado exitosamente", { ticketId: data?.id })
    return data;
  } catch (error) {
    console.error("[v0] Error en updateTicketReceipt:", redactForLog(error))
    throw error;
  }
}
