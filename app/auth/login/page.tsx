"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { setAuthFeedback } from "@/components/auth-feedback"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // La navegación completa garantiza que el middleware reciba las cookies
      // recién actualizadas por Supabase antes de entrar a una ruta protegida.
      // Obtener el usuario autenticado
      const user = signInData.user
      if (!user) throw new Error("No se pudo obtener el usuario")

      // Obtener el perfil del usuario para redirigir según su rol
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()

      const destination = profile?.role === "organizer" || profile?.role === "superadmin"
        ? "/admin"
        : profile?.role === "ticketero"
          ? "/verify"
          : "/"
      setAuthFeedback("login")
      window.location.assign(destination)
      // Dejamos el botón en "Ingresando…" hasta que cargue la página de destino.
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : ""
      const message = /invalid login credentials/i.test(rawMessage)
        ? "Email o contraseña incorrectos."
        : /email not confirmed/i.test(rawMessage)
          ? "Todavía no confirmaste tu email. Revisá tu casilla."
          : rawMessage || "No pudimos iniciar sesión. Probá de nuevo."
      setError(message)
      toast.error(message)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-[#f4eddf] px-5 py-8 text-[#171717] sm:px-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center sm:mb-10">
          <Link href="/" className="inline-block text-[2.25rem] font-black tracking-[-0.08em] text-[#171717] sm:text-[2.75rem]">Te<span className="text-[#f4511e]">k</span>aTeka</Link>
          <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#6b6258]">Más cultura. Más encuentros.</p>
        </div>
        <Card className="rounded-[1.75rem] border-[#e7dcc8] bg-[#fffdf7] shadow-[0_18px_50px_rgba(78,59,38,0.12)]">
          <CardHeader className="px-6 pb-2 pt-7 text-left sm:px-8 sm:pt-8">
            <CardTitle className="text-[1.8rem] tracking-[-0.04em]">Iniciar sesión</CardTitle>
            <CardDescription className="mt-1 text-[#6b6258]">Entrá para ver tus entradas y eventos.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-7 pt-5 sm:px-8 sm:pb-8">
            <form onSubmit={handleLogin} aria-busy={isLoading}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between"><Label htmlFor="password">Contraseña</Label><Link href="/auth/forgot-password" aria-disabled={isLoading} tabIndex={isLoading ? -1 : undefined} onClick={(event) => { if (isLoading) event.preventDefault() }} className="text-xs text-primary underline underline-offset-4">¿Olvidaste tu contraseña?</Link></div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ingresando…</> : "Iniciar Sesión"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link href="/auth/sign-up" aria-disabled={isLoading} tabIndex={isLoading ? -1 : undefined} onClick={(event) => { if (isLoading) event.preventDefault() }} className="underline underline-offset-4 text-foreground hover:text-primary">
                  Registrarte
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
