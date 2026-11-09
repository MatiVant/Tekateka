"use server"

import { getCurrentUser } from "@/lib/auth"
import { sendOrganizerSalesSummary } from "@/lib/sales-summary"

export async function sendWeeklySalesSummary() {
  const userData = await getCurrentUser()
  if (!userData?.user.email || !userData.user.email_confirmed_at || userData.profile?.role !== "organizer") {
    return { success: false, message: "Iniciá sesión con una cuenta de organizador y un correo verificado." }
  }

  try {
    const result = await sendOrganizerSalesSummary(
      { id: userData.user.id, email: userData.user.email, full_name: userData.profile.full_name },
      "week",
    )
    return { success: true, message: `Informe de los últimos 7 días enviado a ${userData.user.email}. Total: ${result.totalSold} entradas.` }
  } catch (error) {
    console.error("[sales-summary] No se pudo enviar el informe semanal:", error)
    return { success: false, message: error instanceof Error ? error.message : "No se pudo enviar el resumen. Intentá de nuevo más tarde." }
  }
}
