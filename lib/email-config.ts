// Remitente único de la plataforma.
// No leer RESEND_FROM_EMAIL ni SUPPORT_EMAIL: el mail de reserva pendiente
// del 21/11 salió como "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>"
// y esta constante era el único lugar que podía devolver ese texto,
// si la variable de entorno venía cargada con el remitente viejo.
export const EMAIL_CONFIG = {
  from: "Tekateka <notificaciones@tekateka.com.ar>",
  replyTo: "consultas@tekateka.com.ar",
  supportEmail: "consultas@tekateka.com.ar",
} as const
