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
    const { data: organizerProfile } = await adminSupabase.from('profiles').select('email').eq('id', organizerId).single();
    const organizerEmail = organizerProfile?.email;

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

      if (process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'TKTK Entradas <notificaciones@tktk.buholabs.com.ar>', to: organizerEmail, subject: 'Tu cuenta de organizador fue aprobada', html: '<p>Tu cuenta de organizador ya está aprobada. Ya podés publicar eventos.</p>' }) });
      }

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

      if (process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'TKTK Entradas <notificaciones@tktk.buholabs.com.ar>', to: organizerEmail, subject: 'Actualización de tu solicitud de organizador', html: `<p>Tu solicitud no fue aprobada.</p><p>Motivo: ${rejectionReason || 'No especificado'}</p>` }) });
      }

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
