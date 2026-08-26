import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Verificar que el usuario actual es superadmin
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { organizerId, action, rejectionReason, subscriptionStatus, expirationDate } = await request.json();
    const adminSupabase = createClient();

    if (action === 'approve') {
      // Aprobar organizador
      const { error } = await adminSupabase
        .from('profiles')
        .update({ 
          organizer_status: 'approved',
          subscription_status: 'free',
        })
        .eq('id', organizerId);

      if (error) throw error;

      // TODO: Enviar email de aprobación
      console.log('[v0] Organizador aprobado:', organizerId);

      return NextResponse.json({ success: true });
    } 
    
    if (action === 'reject') {
      // Rechazar organizador
      const { error } = await adminSupabase
        .from('profiles')
        .update({ 
          organizer_status: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', organizerId);

      if (error) throw error;

      // TODO: Enviar email de rechazo
      console.log('[v0] Organizador rechazado:', organizerId);

      return NextResponse.json({ success: true });
    }
    
    if (action === 'subscription') {
      // Actualizar suscripción
      const updateData: any = {
        subscription_status: subscriptionStatus,
      };

      if (expirationDate) {
        updateData.subscription_expires_at = new Date(expirationDate).toISOString();
      } else {
        updateData.subscription_expires_at = null;
      }

      const { error } = await adminSupabase
        .from('profiles')
        .update(updateData)
        .eq('id', organizerId);

      if (error) throw error;

      console.log('[v0] Suscripción actualizada:', organizerId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error) {
    console.error('[v0] Error en manage-organizer:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
