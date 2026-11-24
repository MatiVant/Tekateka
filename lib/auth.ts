import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hasSuperadminAccess } from "@/lib/superadmin-access";

export { hasSuperadminAccess } from "@/lib/superadmin-access";

// cache(): layout, página y requireAuth comparten la misma consulta de
// usuario + perfil dentro de un mismo request (antes se repetía 2-3 veces).
export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[auth] getCurrentUser - Error al consultar perfil:', error);
    return { user, profile: null };
  }

  if (!profile) return { user, profile: null };

  // Un perfil con rol superadmin cuyo email no está en SUPERADMIN_EMAILS se trata
  // como visitante: así no ve links ni puede usar nada del superadmin.
  if (profile.role === 'superadmin' && !hasSuperadminAccess(user.email, profile.role)) {
    console.warn('[auth] Perfil superadmin fuera de SUPERADMIN_EMAILS, acceso degradado:', user.id);
    return { user, profile: { ...profile, role: 'visitor' } };
  }

  return { user, profile };
});

export async function requireAuth(allowedRoles?: string[]) {
  const userData = await getCurrentUser();

  if (!userData) {
    return { authorized: false, user: null, profile: null };
  }

  // Sin perfil no hay rol, así que no se autoriza nada.
  if (!userData.profile) {
    console.warn('[auth] requireAuth - Usuario sin perfil, acceso denegado:', userData.user.id);
    return { authorized: false, user: userData.user, profile: null };
  }

  if (hasSuperadminAccess(userData.user.email, userData.profile.role)) {
    return { authorized: true, user: userData.user, profile: userData.profile };
  }

  if (allowedRoles && !allowedRoles.includes(userData.profile.role)) {
    return { authorized: false, user: userData.user, profile: userData.profile };
  }

  return { authorized: true, user: userData.user, profile: userData.profile };
}

// Para todo lo que es exclusivo del superadmin: exige sesión, perfil con rol
// superadmin y (si está configurado) email dentro de SUPERADMIN_EMAILS.
export async function requireSuperadmin() {
  const userData = await getCurrentUser();

  if (!userData) {
    return { authorized: false, user: null, profile: null };
  }

  if (!userData.profile || !hasSuperadminAccess(userData.user.email, userData.profile.role)) {
    return { authorized: false, user: userData.user, profile: userData.profile };
  }

  return { authorized: true, user: userData.user, profile: userData.profile };
}
