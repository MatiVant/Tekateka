// Reglas de acceso al superadmin. Sin imports de servidor para poder usarlo
// tanto en el middleware como en páginas, rutas de API y server actions.
//
// Para entrar al superadmin hace falta tener role = 'superadmin' en profiles.
// Si además está definida la variable SUPERADMIN_EMAILS (emails separados por
// coma), el email de la sesión tiene que estar en esa lista. Si la variable no
// está definida, alcanza con el rol.

export function getSuperadminAllowlist(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function hasSuperadminAccess(email: string | null | undefined, role: string | null | undefined): boolean {
  if (role !== "superadmin") return false
  const allowlist = getSuperadminAllowlist()
  if (allowlist.length === 0) return true
  const normalizedEmail = email?.trim().toLowerCase()
  return Boolean(normalizedEmail) && allowlist.includes(normalizedEmail as string)
}
