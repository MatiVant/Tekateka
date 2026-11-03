export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires"

export function formatArgentinaDateTime(value: string | Date | null | undefined) {
  if (!value) return "Fecha no disponible"

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "Fecha no disponible"

  return date.toLocaleString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ARGENTINA_TIME_ZONE,
  })
}
