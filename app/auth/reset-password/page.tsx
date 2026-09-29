"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingLink, setIsCheckingLink] = useState(true)
  const [hasValidRecoverySession, setHasValidRecoverySession] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function verifyRecoveryLink() {
      try {
        const supabase = createClient()
        const code = new URLSearchParams(window.location.search).get("code")

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          window.history.replaceState({}, document.title, window.location.pathname)
          if (isMounted) {
            setHasValidRecoverySession(!exchangeError)
            if (exchangeError) setError("Este enlace venció o ya fue utilizado. Solicitá uno nuevo.")
          }
        } else {
          const { data: { session } } = await supabase.auth.getSession()
          if (isMounted) {
            setHasValidRecoverySession(Boolean(session))
            if (!session) setError("El enlace de recuperación no es válido o venció. Solicitá uno nuevo.")
          }
        }
      } catch {
        if (isMounted) {
          setHasValidRecoverySession(false)
          setError("No pudimos verificar el enlace. Solicitá uno nuevo e intentá otra vez.")
        }
      } finally {
        if (isMounted) setIsCheckingLink(false)
      }
    }

    void verifyRecoveryLink()
    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.")
    if (password !== confirmation) return setError("Las contraseñas no coinciden.")

    setIsLoading(true)
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password })
      if (updateError) {
        const passwordWasReused = /different from the old password|same password/i.test(updateError.message)
        setError(passwordWasReused ? "La nueva contraseña debe ser distinta de la actual." : updateError.message)
      } else {
        setMessage("Tu contraseña fue actualizada correctamente.")
      }
    } catch {
      setError("No pudimos actualizar la contraseña. Intentá nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const isFormDisabled = isCheckingLink || !hasValidRecoverySession || isLoading || Boolean(message)

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Crear nueva contraseña</CardTitle>
          <CardDescription>Elegí una contraseña segura para tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                disabled={isFormDisabled}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError(null)
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmation">Repetir contraseña</Label>
              <Input
                id="confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmation}
                disabled={isFormDisabled}
                onChange={(event) => {
                  setConfirmation(event.target.value)
                  setError(null)
                }}
              />
            </div>
            {isCheckingLink && <p className="text-sm text-muted-foreground" role="status">Verificando el enlace...</p>}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {message && <p className="text-sm text-primary" role="status">{message}</p>}
            <Button type="submit" className="w-full" disabled={isFormDisabled}>
              {isLoading ? "Guardando..." : "Guardar contraseña"}
            </Button>
            {message && <Link href="/auth/login" className="block text-center text-sm underline">Ir a iniciar sesión</Link>}
            {error && !hasValidRecoverySession && !isCheckingLink && (
              <Link href="/auth/forgot-password" className="block text-center text-sm underline">Solicitar otro enlace</Link>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
