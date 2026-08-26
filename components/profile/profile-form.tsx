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
  initialPhone: string
  initialPaymentInfo: string
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  organizer: "Organizador",
  ticketero: "Ticketero",
  user: "Asistente",
}

export function ProfileForm({ email, role, initialFullName, initialPhone, initialPaymentInfo }: ProfileFormProps) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [paymentInfo, setPaymentInfo] = useState(initialPaymentInfo)
  const [isSaving, setIsSaving] = useState(false)

  const isOrganizer = role === "organizer" || role === "superadmin"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const result = await updateProfile({ full_name: fullName, phone, payment_info: paymentInfo })
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
        <Label htmlFor="fullName">Nombre para mostrar *</Label>
        <Input
          id="fullName"
          type="text"
          required
          placeholder="Tu nombre o el de tu productora"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-11"
        />
        {isOrganizer && (
          <p className="text-xs text-muted-foreground">Este nombre aparece como organizador de tus eventos.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono de contacto</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+54 9 11 1234 5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">Lo usamos para contactarte ante cualquier novedad.</p>
      </div>

      {isOrganizer && (
        <div className="space-y-2">
          <Label htmlFor="paymentInfo">Datos de cobro</Label>
          <Input
            id="paymentInfo"
            type="text"
            placeholder="CBU / Alias / CVU"
            value={paymentInfo}
            onChange={(e) => setPaymentInfo(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">Se usa para liquidarte las ventas de tus eventos.</p>
        </div>
      )}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  )
}
