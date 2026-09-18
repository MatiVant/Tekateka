"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (resetError) setError(resetError.message)
    else setMessage("Si existe una cuenta con ese email, te enviamos un enlace para cambiar la contraseña.")
    setIsLoading(false)
  }

  return <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6"><Card className="w-full max-w-sm"><CardHeader className="text-center"><CardTitle>Recuperar contraseña</CardTitle><CardDescription>Te enviaremos un enlace para crear una contraseña nueva.</CardDescription></CardHeader><CardContent><form onSubmit={handleSubmit} className="space-y-5"><div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="tu@email.com" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>{error && <p className="text-sm text-destructive">{error}</p>}{message && <p className="text-sm text-primary">{message}</p>}<Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Enviando..." : "Enviar enlace"}</Button><p className="text-center text-sm text-muted-foreground"><Link href="/auth/login" className="underline underline-offset-4 text-foreground">Volver a iniciar sesión</Link></p></form></CardContent></Card></main>
}
