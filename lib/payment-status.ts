export type PaymentStatus = "pending" | "submitted" | "approved" | "rejected"

export function getPaymentStatusLabel(status?: string | null) {
  switch (status) {
    case "approved":
      return "Pago aprobado"
    case "rejected":
      return "Pago rechazado"
    case "submitted":
      return "Comprobante enviado"
    case "pending":
      return "Pago pendiente"
    default:
      return status || "Sin estado"
  }
}

export function getTicketStatusLabel(status?: string | null) {
  switch (status) {
    case "confirmed":
      return "Confirmada"
    case "pending":
      return "Pendiente"
    case "used":
      return "Usada"
    case "cancelled":
      return "Cancelada"
    default:
      return status || "Sin estado"
  }
}
