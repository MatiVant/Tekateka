// Uso de un código en este dispositivo (localStorage y, en el servidor, cookie httpOnly).
// Es una traba de buena fe, no una garantía: se puede borrar el almacenamiento.
// El chequeo de verdad, si hay mail o usuario, está en lib/promo-usage.ts.

export const PROMO_USED_COOKIE = "tk_promo_used"
export const PROMO_USED_DEVICE_MESSAGE =
  "Ya usaste este código en este dispositivo. Si querés otra entrada, comprala al precio normal."
export const PROMO_USED_ACCOUNT_MESSAGE =
  "Ya usaste este código. Si querés otra entrada, comprala al precio normal."

const STORAGE_KEY = "tekateka.promoUsed"
const MAX_ENTRIES = 50

export function promoUsageKey(eventId: string, code: string) {
  return `${eventId.trim().toLowerCase()}:${code.trim().toUpperCase()}`
}

export function parsePromoUsedCookie(value: string | undefined | null): string[] {
  if (!value) return []
  return value.split("|").map((item) => item.trim()).filter(Boolean)
}

export function serializePromoUsedCookie(keys: string[]): string {
  return keys.slice(-MAX_ENTRIES).join("|")
}

export function cookieHasPromo(value: string | undefined | null, eventId: string, code: string) {
  return parsePromoUsedCookie(value).includes(promoUsageKey(eventId, code))
}

export function cookieWithPromo(value: string | undefined | null, eventId: string, code: string) {
  const key = promoUsageKey(eventId, code)
  return serializePromoUsedCookie([...parsePromoUsedCookie(value).filter((item) => item !== key), key])
}

export function wasPromoUsedOnDevice(eventId: string, code: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw) as Record<string, string>
    return Boolean(data[promoUsageKey(eventId, code)])
  } catch {
    return false
  }
}

export function markPromoUsedOnDevice(eventId: string, code: string) {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const data = (raw ? JSON.parse(raw) : {}) as Record<string, string>
    data[promoUsageKey(eventId, code)] = new Date().toISOString()
    const entries = Object.entries(data)
    const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : Object.fromEntries(entries)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Si el navegador bloquea localStorage, queda la cookie del servidor.
  }
}

export function clearPromoUsedOnDevice(eventId: string, code: string) {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as Record<string, string>
    delete data[promoUsageKey(eventId, code)]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // noop
  }
}
