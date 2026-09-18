"use client"

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

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")
    if (!code) return
    const supabase = createClient()
    void supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) setError("Este enlace venció o ya fue utilizado. Solicitá uno nuevo.")
    })
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.")
    if (password !== confirmation) return setError("Las contraseñas no coinciden.")
    setIsLoading(true)
    setError(null)
    const { error: updateError } = await createClient().auth.updateUser({ password })
    if (updateError) setError(updateError.message)
    else setMessage("Tu contraseña fue actualizada correctamente.")
    setIsLoading(false)
  }

  return <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6"><Card className="w-full max-w-sm"><CardHeader className="text-center"><CardTitle>Crear nueva contraseña</CardTitle><CardDescription>Elegí una contraseña segura para tu cuenta.</CardDescription></CardHeader><CardContent><form onSubmit={handleSubmit} className="space-y-5"><div className="grid gap-2"><Label htmlFor="password">Nueva contraseña</Label><Input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="confirmation">Repetir contraseña</Label><Input id="confirmation" type="password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>{error && <p className="text-sm text-destructive">{error}</p>}{message && <p className="text-sm text-primary">{message}</p>}<Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Guardando..." : "Guardar contraseña"}</Button>{message && <Link href="/auth/login" className="block text-center text-sm underline">Ir a iniciar sesión</Link>}</form></CardContent></Card></main>
}
