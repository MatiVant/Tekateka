import { createClient } from "@/lib/supabase/admin"

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

export interface RateLimitResult {
  success: boolean
  remaining?: number
  resetAt?: Date
}

/**
 * Límite por IP usando la función consume_rate_limit en Supabase.
 * Si la tabla o la función todavía no existen, deja pasar la solicitud
 * para no frenar compras legítimas antes de correr la migración.
 *
 * Límites a propósito altos:
 * - checkout: 150 cada 15 minutos (reintentos y varias personas en la misma red)
 * - reenvío de entradas o de link de pago: 60 por hora
 * - soporte: 15 por hora
 * - correo de reserva: 40 cada 30 minutos
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_identifier: identifier,
      p_endpoint: endpoint,
      p_window_seconds: Math.max(1, Math.ceil(config.windowMs / 1000)),
      p_max_requests: config.maxRequests,
    })

    if (error) {
      console.error("[rate-limit] No se pudo aplicar el límite", { endpoint, code: error.code })
      return { success: true }
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; remaining?: number; reset_at?: string }
      | null
      | undefined
    if (!row || typeof row.allowed !== "boolean") return { success: true }

    return {
      success: row.allowed,
      remaining: row.remaining,
      resetAt: row.reset_at ? new Date(row.reset_at) : undefined,
    }
  } catch (error) {
    console.error("[rate-limit] Error inesperado", { endpoint, error: error instanceof Error ? error.message : "unknown" })
    return { success: true }
  }
}

export function identifierFromHeaders(getHeader: (name: string) => string | null): string {
  const forwarded = getHeader("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : getHeader("x-real-ip") || "unknown"
  return `ip:${ip}`
}

export function getClientIdentifier(request: Request): string {
  return identifierFromHeaders((name) => request.headers.get(name))
}

export function rateLimitMessage(resetAt?: Date, fallbackSeconds = 60) {
  const seconds = resetAt ? Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)) : fallbackSeconds
  if (seconds < 90) {
    return `Recibimos demasiados intentos juntos. Esperá unos ${seconds} segundos y volvé a intentar.`
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return `Recibimos demasiados intentos juntos. Esperá unos ${minutes} minutos y volvé a intentar.`
}

export const RATE_LIMITS = {
  checkout: { windowMs: 15 * 60 * 1000, maxRequests: 150 },
  resendTicket: { windowMs: 60 * 60 * 1000, maxRequests: 60 },
  resendPaymentLink: { windowMs: 60 * 60 * 1000, maxRequests: 60 },
  support: { windowMs: 60 * 60 * 1000, maxRequests: 15 },
  purchaseEmail: { windowMs: 30 * 60 * 1000, maxRequests: 40 },
  attendeeName: { windowMs: 60 * 60 * 1000, maxRequests: 120 },
  venueProposal: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 10 },
} as const
