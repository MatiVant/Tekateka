"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/admin"
import { requireSuperadmin } from "@/lib/auth"

export type SaveVenueResult = { ok: true } | { ok: false; error: string }

const MAX_NAME = 120
const MAX_ADDRESS = 200
const MAX_URL = 500
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const text = (value: FormDataEntryValue | null) => String(value ?? "").replace(/\s+/g, " ").trim()

// Alta y edición de espacios del catálogo (solo superadmin). La dirección se
// usa en los mails de entradas y en la página pública del evento.
export async function saveVenue(formData: FormData): Promise<SaveVenueResult> {
  const { authorized } = await requireSuperadmin()
  if (!authorized) return { ok: false, error: "No autorizado" }

  const id = text(formData.get("id"))
  const name = text(formData.get("name"))
  const address = text(formData.get("address"))
  const locationUrl = text(formData.get("location_url"))

  if (id && !UUID_PATTERN.test(id)) return { ok: false, error: "Espacio inválido" }
  if (name.length < 2 || name.length > MAX_NAME) return { ok: false, error: `El nombre debe tener entre 2 y ${MAX_NAME} caracteres` }
  if (address.length > MAX_ADDRESS) return { ok: false, error: `La dirección puede tener hasta ${MAX_ADDRESS} caracteres` }
  if (locationUrl) {
    if (locationUrl.length > MAX_URL) return { ok: false, error: "El link de Maps es demasiado largo" }
    try {
      const parsed = new URL(locationUrl)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocolo")
    } catch {
      return { ok: false, error: "El link de Maps no es una URL válida" }
    }
  }

  const values = { name, address: address || null, location_url: locationUrl || null }
  const supabase = createClient()
  const { error } = id
    ? await supabase.from("venues").update(values).eq("id", id)
    : await supabase.from("venues").insert(values)

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya existe un espacio con ese nombre" }
    console.error("[venues] No se pudo guardar el espacio:", error.message)
    return { ok: false, error: "No se pudo guardar el espacio" }
  }

  revalidatePath("/superadmin")
  revalidatePath("/admin/events/new")
  revalidatePath("/eventos")
  return { ok: true }
}
