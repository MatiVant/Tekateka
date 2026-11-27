// Entradas gratis que esperan la aprobación del organizador.
//
// No hay un estado nuevo: una solicitud es un ticket 'pending' con payment_method = 'free'.
// Las entradas gratis normales se confirman en el momento, así que esa combinación
// solo existe cuando el evento pide aprobación. 'pending' ya cuenta para el cupo
// en todas las consultas y no tiene vencimiento automático.

export const APPROVAL_DISABLED_MESSAGE =
  "Pedir aprobación del organizador todavía no está habilitado. Falta correr el script 050 en Supabase."

// Solo cuando falta la columna (script 050) o PostgREST todavía no la ve.
export function isMissingApprovalColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  if (error.code !== "42703" && error.code !== "PGRST204") return false
  const message = error.message ?? ""
  return !message || /requires_approval/i.test(message)
}

type ApprovalTicketLike = {
  status?: string | null
  payment_method?: string | null
  rejection_reason?: string | null
}

export function isAwaitingApproval(ticket: ApprovalTicketLike) {
  return ticket.status === "pending" && ticket.payment_method === "free"
}

export function isRejectedApproval(ticket: ApprovalTicketLike) {
  return ticket.status === "cancelled" && ticket.payment_method === "free" && Boolean(ticket.rejection_reason)
}
