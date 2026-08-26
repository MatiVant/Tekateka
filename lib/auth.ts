import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  console.log('[v0] getCurrentUser - Consultando perfil para user:', user.id);
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (error) {
    console.error('[v0] getCurrentUser - Error al consultar perfil:', error);
    return { user, profile: null };
  }
  
  console.log('[v0] getCurrentUser - Perfil obtenido:', profile?.role);
  
  return { user, profile };
}

export async function requireAuth(allowedRoles?: string[]) {
  const userData = await getCurrentUser();
  
  if (!userData) {
    console.log('[v0] requireAuth - No hay datos de usuario');
    return { authorized: false, user: null, profile: null };
  }
  
  if (!userData.profile) {
    console.log('[v0] requireAuth - Usuario sin perfil, autorizando temporalmente');
    return { authorized: true, user: userData.user, profile: null };
  }
  
  if (userData.profile.role === 'superadmin') {
    console.log('[v0] requireAuth - Superadmin detectado, autorizando');
    return { authorized: true, user: userData.user, profile: userData.profile };
  }
  
  if (allowedRoles && !allowedRoles.includes(userData.profile.role)) {
    console.log('[v0] requireAuth - Rol no autorizado:', userData.profile.role, 'permitidos:', allowedRoles);
    return { authorized: false, user: userData.user, profile: userData.profile };
  }
  
  console.log('[v0] requireAuth - Autorizado con rol:', userData.profile.role);
  return { authorized: true, user: userData.user, profile: userData.profile };
}
