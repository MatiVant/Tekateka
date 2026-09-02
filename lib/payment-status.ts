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

export function getMovementTypeLabel(type?: string | null) {
  switch (type) {
    case "ticket_created":
      return "Entrada creada"
    case "ticket_sale":
      return "Venta de entrada"
    case "ticket_payment":
      return "Pago de entrada"
    case "platform_fee":
      return "Comisión de plataforma"
    case "organizer_payout":
      return "Liquidación al organizador"
    case "refund":
      return "Reembolso"
    case "ticket_refund":
      return "Reembolso de entrada"
    default:
      return type ? type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Movimiento"
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
