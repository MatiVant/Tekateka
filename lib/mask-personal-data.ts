/**
 * Enmascara datos personales en logs (Ley 25.326).
 * No usar para armar correos ni para lógica de negocio.
 */

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "***@***"

  const [local, domain] = email.split("@")
  if (!domain) return "***@***"
  if (local.length <= 2) return `${local.slice(0, 1)}***@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}

export function maskName(name: string | null | undefined): string {
  if (!name || name.trim().length === 0) return "***"
  return name
    .trim()
    .split(/\s+/)
    .map((part) => `${part.slice(0, 1)}***`)
    .join(" ")
}

function isPersonalKey(key: string) {
  return /email|name|phone|recipient|telefono|teléfono/i.test(key)
}

export function redactForLog(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(EMAIL_PATTERN, (email) => maskEmail(email))
  }
  if (value instanceof Error) {
    return { name: value.name, message: redactForLog(value.message) }
  }
  if (Array.isArray(value)) return value.map((item) => redactForLog(item))
  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      if (typeof nested === "string" && isPersonalKey(key)) {
        redacted[key] = /email|recipient/i.test(key) ? maskEmail(nested) : maskName(nested)
      } else {
        redacted[key] = redactForLog(nested)
      }
    }
    return redacted
  }
  return value
}
