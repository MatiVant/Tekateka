"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

export function ChangePasswordForm() {
  const { toast } = useToast()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving) return

    if (password.length < 12 || password.length > 128) {
      toast({
        variant: "destructive",
        title: "Contraseña no válida",
        description: "Usá entre 12 y 128 caracteres.",
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Las contraseñas no coinciden",
        description: "Revisá ambas contraseñas e intentá nuevamente.",
      })
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        toast({
          variant: "destructive",
          title: "No se pudo cambiar la contraseña",
          description: error.message,
        })
        return
      }

      setPassword("")
      setConfirmPassword("")
      toast({
        title: "Contraseña actualizada",
        description: "Se cambió la contraseña de tu cuenta. No enviamos un enlace de recuperación.",
      })
    } catch {
      toast({
        variant: "destructive",
        title: "No se pudo cambiar la contraseña",
        description: "Revisá tu conexión e intentá nuevamente.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">Usá al menos 12 caracteres.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Confirmar contraseña</Label>
        <Input
          id="confirm-new-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="h-11"
        />
        {confirmPassword.length > 0 && password !== confirmPassword && (
          <p className="text-sm text-destructive" role="alert">Las contraseñas no coinciden.</p>
        )}
      </div>

      <Button type="submit" disabled={isSaving || password.length < 12 || password.length > 128 || password !== confirmPassword}>
        {isSaving ? "Actualizando..." : "Cambiar contraseña"}
      </Button>
    </form>
  )
}
