// Ubicación del evento para los mails: nombre del lugar y dirección escrita,
// más un link opcional a Google Maps. Sin imports para poder usarlo en
// cualquier lado (server actions, rutas de API y scripts de preview).

type VenueRow = { name?: string | null; address?: string | null; location_url?: string | null }

export type EventLocationInput = {
  venue?: string | null
  location_url?: string | null
  venues?: VenueRow | VenueRow[] | null
}

export type EventLocation = {
  name: string | null
  address: string | null
  mapUrl: string
}

const clean = (value: string | null | undefined) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim()
  return text.length > 0 ? text : null
}

const isCoordinates = (value: string) => /^@?-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+/.test(value)

const decodePart = (value: string) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "))
  } catch {
    return value.replace(/\+/g, " ")
  }
}

// Saca la dirección escrita de un link de Google Maps cuando viene en la URL
// (?q=, ?query=, ?destination=, /maps/place/..., /maps/search/..., /maps/dir/...).
// Los links cortos (maps.app.goo.gl) no la traen: para esos usamos resolveShortMapsUrl.
export function extractAddressFromMapsUrl(rawUrl: string | null | undefined): string | null {
  const url = clean(rawUrl)
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!/google\.|goo\.gl/i.test(parsed.hostname)) return null

  for (const key of ["q", "query", "destination", "daddr", "address"]) {
    const value = clean(parsed.searchParams.get(key))
    if (value && !isCoordinates(value)) return value
  }

  const match = parsed.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/) ?? parsed.pathname.match(/\/maps\/dir\/[^/]*\/([^/]+)/)
  if (match) {
    const value = clean(decodePart(match[1]))
    if (value && !isCoordinates(value)) return value
  }
  return null
}

// Los links cortos de "Compartir" de Google Maps redirigen a la URL larga, que sí
// trae la dirección. Seguimos solo la primera redirección, con un timeout corto,
// y si algo falla simplemente no mostramos la dirección.
export async function resolveShortMapsUrl(rawUrl: string | null | undefined): Promise<string | null> {
  const url = clean(rawUrl)
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const isShortLink = /^(maps\.app\.goo\.gl|goo\.gl)$/i.test(parsed.hostname)
  if (!isShortLink) return null
  try {
    const response = await fetch(parsed.toString(), { method: "GET", redirect: "manual", signal: AbortSignal.timeout(2500) })
    return response.headers.get("location")
  } catch {
    return null
  }
}

export async function getEventLocation(input: EventLocationInput | null | undefined): Promise<EventLocation> {
  const venueRow = Array.isArray(input?.venues) ? input?.venues[0] : input?.venues
  const name = clean(input?.venue) ?? clean(venueRow?.name)
  const locationUrl = clean(input?.location_url) ?? clean(venueRow?.location_url)

  let address = clean(venueRow?.address) ?? extractAddressFromMapsUrl(locationUrl)
  if (!address && locationUrl) address = extractAddressFromMapsUrl(await resolveShortMapsUrl(locationUrl))

  // Si la dirección arranca repitiendo el nombre del lugar ("Club X, Av. Siempreviva 742"),
  // mostramos solo la parte de la calle; si es exactamente el nombre, no la repetimos.
  if (address && name) {
    const lowerAddress = address.toLocaleLowerCase("es-AR")
    const lowerName = name.toLocaleLowerCase("es-AR")
    if (lowerAddress === lowerName) address = null
    else if (lowerAddress.startsWith(`${lowerName},`)) address = clean(address.slice(name.length + 1))
  }

  const query = [name, address].filter(Boolean).join(", ")
  const mapUrl = locationUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "TekaTeka")}`
  return { name, address, mapUrl }
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

// Bloque HTML (estilos inline, apto para clientes de mail) con el lugar y la
// dirección en texto, y un link chico a Maps como extra.
export function renderEventLocationHtml(location: EventLocation, options: { fontSize?: number } = {}) {
  const fontSize = options.fontSize ? `font-size:${options.fontSize}px;` : ""
  const lines: string[] = []
  if (location.name) lines.push(`<strong>Lugar:</strong> ${escapeHtml(location.name)}`)
  if (location.address) lines.push(`<strong>Dirección:</strong> ${escapeHtml(location.address)}`)
  if (lines.length === 0) lines.push("<strong>Lugar:</strong> a confirmar por la organización")
  const mapLabel = location.address || location.name ? "Ver en Google Maps" : "Buscar en Google Maps"
  return `<p style="${fontSize}margin:12px 0 6px;line-height:1.5">${lines.join("<br>")}</p><p style="margin:0 0 12px;font-size:13px"><a href="${escapeHtml(location.mapUrl)}" style="color:#f4511e;font-weight:bold;text-decoration:underline">${mapLabel}</a></p>`
}
