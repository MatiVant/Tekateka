"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { updateProfile } from "@/app/actions/update-profile"

interface ProfileFormProps {
  email: string
  role: string
  initialFullName: string
  initialOrganizationName: string
  initialPhone: string
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  organizer: "Organizador",
  ticketero: "Ticketero",
  user: "Asistente",
}

export function ProfileForm({ email, role, initialFullName, initialOrganizationName, initialPhone }: ProfileFormProps) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState(initialFullName)
  const [organizationName, setOrganizationName] = useState(initialOrganizationName)
  const [phone, setPhone] = useState(initialPhone)
  const [isSaving, setIsSaving] = useState(false)

  const isOrganizer = role === "organizer" || role === "superadmin"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const result = await updateProfile({ full_name: fullName, organization_name: organizationName, phone })
    setIsSaving(false)

    if (result.error) {
      toast({ variant: "destructive", title: "Error", description: result.error })
      return
    }
    toast({ title: "Perfil actualizado", description: "Tus datos se guardaron correctamente." })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} disabled className="h-11" />
        <p className="text-xs text-muted-foreground">
          El email es tu identificador de acceso y no puede modificarse aquí.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Rol</Label>
        <Input id="role" type="text" value={ROLE_LABELS[role] || role} disabled className="h-11" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">{isOrganizer ? "Nombre y apellido del organizador *" : "Nombre completo *"}</Label>
        <Input
          id="fullName"
          type="text"
          required
          placeholder="Ej.: Patricio Benetti"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-11"
        />
        {isOrganizer && (
          <p className="text-xs text-muted-foreground">Este es tu nombre personal como responsable del espacio.</p>
        )}
      </div>

      {isOrganizer && (
        <div className="space-y-2">
          <Label htmlFor="organizationName">Nombre del espacio *</Label>
          <Input
            id="organizationName"
            type="text"
            required
            placeholder="Ej.: La lengua del Juglar"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">Este nombre se muestra en tu sitio público y define su enlace.</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono de contacto {isOrganizer ? "*" : ""}</Label>
        <Input
          id="phone"
          type="tel"
          required={isOrganizer}
          placeholder="+54 9 11 1234 5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">
          {isOrganizer
            ? "Obligatorio: lo usamos para contactarte ante cualquier novedad de tus eventos."
            : "Lo usamos para contactarte ante cualquier novedad."}
        </p>
      </div>

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  )
}
