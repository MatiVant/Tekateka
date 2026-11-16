"use server"

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/admin"

export async function updateEventPriority(eventId: string, priority: number) {
  const { authorized } = await requireAuth(["superadmin"])
  if (!authorized) throw new Error("No autorizado")
  if (!Number.isInteger(priority) || priority < 0 || priority > 2) throw new Error("Prioridad inválida")
  const supabase = createClient()
  const { error } = await supabase.from("events").update({ priority }).eq("id", eventId)
  if (error) throw new Error("No se pudo actualizar la prioridad")
  revalidatePath("/")
  revalidatePath("/eventos")
  revalidatePath("/superadmin/events")
}
