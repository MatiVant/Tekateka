"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
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
  initialOrganizationCoverImageUrl: string
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  organizer: "Organizador",
  ticketero: "Ticketero",
  user: "Asistente",
}

export function ProfileForm({ email, role, initialFullName, initialOrganizationName, initialPhone, initialOrganizationCoverImageUrl }: ProfileFormProps) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState(initialFullName)
  const [organizationName, setOrganizationName] = useState(initialOrganizationName)
  const [phone, setPhone] = useState(initialPhone)
  const [coverImageUrl, setCoverImageUrl] = useState(initialOrganizationCoverImageUrl)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const isOrganizer = role === "organizer" || role === "superadmin"

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ variant: "destructive", title: "Formato no válido", description: "Elegí una imagen JPG, PNG o WebP." })
      event.target.value = ""
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Imagen demasiado pesada", description: "La portada no debe superar los 5 MB." })
      event.target.value = ""
      return
    }

    setIsUploadingCover(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/upload/organization-cover", { method: "POST", body: formData, credentials: "same-origin" })
      const result = await response.json()
      if (!response.ok || typeof result.url !== "string" || !result.url.startsWith("https://")) {
        throw new Error(result.error || "No se pudo subir la portada.")
      }
      setCoverImageUrl(result.url)
      toast({ title: "Portada cargada", description: "Guardá los cambios para publicarla en tu espacio." })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo subir la portada",
        description: error instanceof Error ? error.message : "Intentá nuevamente.",
      })
    } finally {
      setIsUploadingCover(false)
      event.target.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const result = await updateProfile({
      full_name: fullName,
      organization_name: organizationName,
      organization_cover_image_url: coverImageUrl,
      phone,
    })
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

      {isOrganizer && (
        <div className="space-y-3">
          <Label htmlFor="organizationCover">Imagen de portada del espacio</Label>
          {coverImageUrl && (
            <Image
              src={coverImageUrl}
              alt="Vista previa de la portada del espacio"
              width={1280}
              height={480}
              unoptimized
              className="aspect-[8/3] w-full rounded-lg border object-cover"
            />
          )}
          <Input
            id="organizationCover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploadingCover}
            onChange={handleCoverUpload}
            className="h-11 cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
          />
          <p className="text-xs text-muted-foreground">JPG, PNG o WebP, hasta 5 MB. Se muestra en la página pública del espacio al guardar los cambios.</p>
          {coverImageUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setCoverImageUrl("")}>
              Quitar portada
            </Button>
          )}
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

      <Button type="submit" disabled={isSaving || isUploadingCover}>
        {isSaving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  )
}
