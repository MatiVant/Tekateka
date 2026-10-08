import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  let stage = 'authenticate';
  let requestedAction = 'unknown';
  let isSuperadmin = false;

  try {
    // Verificar que el usuario actual es superadmin
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    stage = 'authorize-superadmin';
    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    isSuperadmin = true;

    const { organizerId, action, rejectionReason, subscriptionStatus, expirationDate, newPassword } = await request.json();
    requestedAction = typeof action === 'string' ? action : 'unknown';
    stage = 'initialize-admin-client';
    const adminSupabase = createClient();

    if (action === 'password-reset' || action === 'password-set') {
      stage = 'validate-organizer-id';
      if (typeof organizerId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizerId)) {
        return NextResponse.json({ error: 'Organizador inválido' }, { status: 400 });
      }

      stage = 'lookup-organizer-profile';
      const { data: organizer, error: organizerError } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('id', organizerId)
        .eq('role', 'organizer')
        .maybeSingle();

      if (organizerError) throw organizerError;
      if (!organizer) return NextResponse.json({ error: 'No se encontró el organizador' }, { status: 404 });

      if (action === 'password-set') {
        stage = 'validate-new-password';
        if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) {
          return NextResponse.json({ error: 'La contraseña debe tener entre 12 y 128 caracteres.' }, { status: 400 });
        }

        stage = 'set-organizer-password';
        const { error: passwordError } = await adminSupabase.auth.admin.updateUserById(organizerId, {
          password: newPassword,
        });
        if (passwordError) throw passwordError;

        return NextResponse.json({ success: true });
      }

      stage = 'lookup-auth-user';
      const { data: { user: targetUser }, error: targetUserError } = await adminSupabase.auth.admin.getUserById(organizerId);
      if (targetUserError) throw targetUserError;
      if (!targetUser?.email) return NextResponse.json({ error: 'El organizador no tiene un email asociado' }, { status: 404 });

      stage = 'send-recovery-email';
      const emailClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { error: resetError } = await emailClient.auth.resetPasswordForEmail(targetUser.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tktk.buholabs.com.ar'}/auth/reset-password`,
      });

      if (resetError) {
        console.error('[v0] Supabase rechazó el correo de recuperación:', {
          message: resetError.message,
          code: resetError.code,
          status: resetError.status,
        });
        return NextResponse.json({ error: resetError.message }, { status: 502 });
      }
      return NextResponse.json({ success: true });
    }

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
      const updateData: Record<string, string | null> = {
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
    console.error('[v0] Error en manage-organizer:', {
      action: requestedAction,
      stage,
      error,
    });
    if (isSuperadmin && ['password-reset', 'password-set'].includes(requestedAction) && error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
