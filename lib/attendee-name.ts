import type { SupabaseClient } from "@supabase/supabase-js"

export const ATTENDEE_NAME_MAX = 80
export const ATTENDEE_NAME_MIN = 2
export const ATTENDEE_NAME_DISABLED_MESSAGE =
  "Poner nombre a cada entrada todavía no está habilitado. Probá de nuevo en un rato."

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value: string) => UUID_PATTERN.test(value)

// 42703 = Postgres (columna inexistente), PGRST204 = PostgREST (columna fuera de caché).
export function isMissingAttendeeColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === "42703" || error.code === "PGRST204" || /attendee_name/i.test(error.message ?? "")
}

export function normalizeAttendeeName(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = String(raw ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  if (!value) return { ok: true, value: null }
  if (value.length < ATTENDEE_NAME_MIN) return { ok: false, error: "El nombre es demasiado corto" }
  if (value.length > ATTENDEE_NAME_MAX) return { ok: false, error: `El nombre puede tener hasta ${ATTENDEE_NAME_MAX} caracteres` }
  return { ok: true, value }
}

export function escapeAttendeeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

// Los nombres se leen aparte (y sin romper si la migración 049 todavía no corrió):
// si la columna no existe, simplemente no hay nombres y todo sigue como antes.
export async function fetchAttendeeNamesByIds(supabase: SupabaseClient, ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const unique = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await supabase.from("tickets").select("id, attendee_name").in("id", unique.slice(i, i + 100))
    if (error) return out
    for (const row of data ?? []) if (row.attendee_name) out[row.id] = row.attendee_name
  }
  return out
}

export async function fetchAttendeeNamesForEvent(supabase: SupabaseClient, eventId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const { data, error } = await supabase
    .from("tickets")
    .select("id, attendee_name")
    .eq("event_id", eventId)
    .not("attendee_name", "is", null)
    .limit(5000)
  if (error) return out
  for (const row of data ?? []) if (row.attendee_name) out[row.id] = row.attendee_name
  return out
}

export async function fetchAttendeeNameByQr(supabase: SupabaseClient, qrCode: string): Promise<string | null> {
  const { data, error } = await supabase.from("tickets").select("attendee_name").eq("qr_code", qrCode).maybeSingle()
  if (error) return null
  return data?.attendee_name ?? null
}

// Líneas para los mails de entradas.
export function attendeeNameLineHtml(name: string | null | undefined) {
  return name ? `<p style="margin:8px 0">A nombre de: <strong>${escapeAttendeeHtml(name)}</strong></p>` : ""
}

export function attendeeNameHintHtml(siteUrl: string, hasAccount: boolean) {
  const base = siteUrl.replace(/\/$/, "")
  return hasAccount
    ? `<p style="font-size:13px;color:#6b6258">¿Las entradas son para otras personas? Podés ponerle nombre a cada una desde <a href="${base}/my-tickets" style="color:#f4511e">Mis entradas</a>.</p>`
    : `<p style="font-size:13px;color:#6b6258">¿Las entradas son para otras personas? <a href="${base}/auth/sign-up" style="color:#f4511e">Creá tu cuenta con este email</a> y entrá a Mis entradas para ponerle nombre a cada una.</p>`
}
