"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { updateOrganizerCover } from "@/app/actions/update-organizer-cover"

type OrganizerCoverAdminEditorProps = {
  organizerProfileId: string
  currentCoverUrl: string | null
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export function OrganizerCoverAdminEditor({ organizerProfileId, currentCoverUrl }: OrganizerCoverAdminEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(file?: File) {
    if (!file) return
    setError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Elegí una imagen JPG, PNG o WebP.")
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("La imagen no puede superar los 5 MB.")
      return
    }

    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadResponse = await fetch("/api/upload/organization-cover", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      })
      const uploadResult = await uploadResponse.json()
      if (!uploadResponse.ok || typeof uploadResult.url !== "string") {
        throw new Error(uploadResult.error || "No se pudo subir la imagen.")
      }

      const result = await updateOrganizerCover(organizerProfileId, uploadResult.url)
      if (result.error) throw new Error(result.error)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar la portada.")
    } finally {
      setIsSaving(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleRemove() {
    setError(null)
    setIsSaving(true)
    try {
      const result = await updateOrganizerCover(organizerProfileId, null)
      if (result.error) throw new Error(result.error)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo quitar la portada.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-white/20 bg-black/65 p-3 text-white shadow-xl backdrop-blur-sm sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={isSaving} onClick={() => inputRef.current?.click()}>
          {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          {isSaving ? "Guardando…" : "Cambiar portada"}
        </Button>
        {currentCoverUrl && (
          <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-white/15 hover:text-white" disabled={isSaving} onClick={handleRemove}>
            <Trash2 className="mr-2 h-4 w-4" />Quitar
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Elegir imagen de portada del organizador"
        onChange={(event) => void handleChange(event.currentTarget.files?.[0])}
      />
      <p className="mt-2 text-xs leading-relaxed text-white/85">
        Recomendado: 1920 × 720 px. JPG, PNG o WebP, hasta 5 MB. Dejá lo importante centrado para que se vea bien en celular.
      </p>
      {error && <p role="alert" className="mt-2 text-xs font-medium text-red-200">{error}</p>}
    </div>
  )
}
