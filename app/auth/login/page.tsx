"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      router.refresh()

      // Obtener el usuario autenticado
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No se pudo obtener el usuario")

      // Obtener el perfil del usuario para redirigir según su rol
      const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single()

      if (profile?.role === "organizer" || profile?.role === "superadmin") {
        router.push("/admin")
      } else if (profile?.role === "ticketero") {
        router.push("/verify")
      } else {
        router.push("/")
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error al iniciar sesión")
    } finally {
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
            <form onSubmit={handleLogin}>
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
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between"><Label htmlFor="password">Contraseña</Label><Link href="/auth/forgot-password" className="text-xs text-primary underline underline-offset-4">¿Olvidaste tu contraseña?</Link></div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link href="/auth/sign-up" className="underline underline-offset-4 text-foreground hover:text-primary">
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
