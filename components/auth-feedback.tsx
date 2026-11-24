"use client"

import { useEffect } from "react"
import { toast } from "sonner"

// Aviso que sobrevive a la recarga completa que hacemos al iniciar o cerrar
// sesión: se guarda en sessionStorage antes de navegar y se muestra al llegar.
const AUTH_FEEDBACK_KEY = "tk-auth-feedback"

export type AuthFeedback = "login" | "logout"

export function setAuthFeedback(feedback: AuthFeedback) {
  try {
    window.sessionStorage.setItem(AUTH_FEEDBACK_KEY, feedback)
  } catch {
    // Sin sessionStorage (modo privado estricto) simplemente no mostramos el aviso.
  }
}

export function AuthFeedbackToast() {
  useEffect(() => {
    let feedback: string | null = null
    try {
      feedback = window.sessionStorage.getItem(AUTH_FEEDBACK_KEY)
      window.sessionStorage.removeItem(AUTH_FEEDBACK_KEY)
    } catch {
      return
    }
    if (feedback === "login") toast.success("¡Hola! Ya iniciaste sesión")
    if (feedback === "logout") toast.success("Sesión cerrada. ¡Hasta la próxima!")
  }, [])

  return null
}
