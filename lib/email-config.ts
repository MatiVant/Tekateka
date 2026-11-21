// Configuración centralizada de emails
export const EMAIL_CONFIG = {
  // Remitente de notificaciones (Resend)
  from: process.env.RESEND_FROM_EMAIL || "Tekateka <notificaciones@tekateka.com.ar>",
  // Email de respuesta y soporte
  replyTo: process.env.SUPPORT_EMAIL || "consultas@tekateka.com.ar",
  supportEmail: process.env.SUPPORT_EMAIL || "consultas@tekateka.com.ar",
} as const
