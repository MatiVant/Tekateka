"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth"

function normalizePercent(value: FormDataEntryValue | null) {
  const percent = Number(value)
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("La comisión debe estar entre 0 y 100")
  return Math.round(percent * 100) / 100
}

export async function updatePlatformFee(formData: FormData) {
  const { authorized } = await requireAuth(["superadmin"])
  if (!authorized) throw new Error("No autorizado")
  const percent = normalizePercent(formData.get("percent"))
  const venueId = String(formData.get("venueId") || "")
  const supabase = createClient()
  const result = venueId
    ? await supabase.from("venues").update({ platform_fee_percent: percent }).eq("id", venueId)
    : await supabase.from("platform_settings").update({ platform_fee_percent: percent, updated_at: new Date().toISOString() }).eq("id", true)
  if (result.error) throw new Error("No se pudo guardar la comisión")
  revalidatePath("/superadmin")
  revalidatePath("/events", "page")
}

export async function clearVenuePlatformFee(formData: FormData) {
  const { authorized } = await requireAuth(["superadmin"])
  if (!authorized) throw new Error("No autorizado")
  const venueId = String(formData.get("venueId") || "")
  if (!venueId) throw new Error("Espacio inválido")
  const supabase = createClient()
  const { error } = await supabase.from("venues").update({ platform_fee_percent: null }).eq("id", venueId)
  if (error) throw new Error("No se pudo restablecer la comisión")
  revalidatePath("/superadmin")
  revalidatePath("/events", "page")
}
