"use client"

import type React from "react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { updateHomepageCover } from "@/app/actions/update-homepage-cover"

export function HomepageCoverEditor() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ variant: "destructive", title: "Formato no válido", description: "Elegí una imagen JPG, PNG o WebP." })
      event.target.value = ""
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Imagen demasiado pesada", description: "La imagen no debe superar los 5 MB." })
      event.target.value = ""
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("scope", "homepage")
      const response = await fetch("/api/upload/organization-cover", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      })
      const uploadResult = await response.json()
      if (!response.ok || typeof uploadResult.url !== "string") {
        throw new Error(uploadResult.error || "No se pudo subir la imagen.")
      }

      const saveResult = await updateHomepageCover(uploadResult.url)
      if (saveResult.error) throw new Error(saveResult.error)

      toast({ title: "Portada actualizada", description: "La nueva imagen ya se muestra en la página de inicio." })
      router.refresh()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo actualizar la portada",
        description: error instanceof Error ? error.message : "Intentá nuevamente.",
      })
    } finally {
      setIsUploading(false)
      event.target.value = ""
    }
  }

  return (
    <div className="flex max-w-[min(22rem,calc(100vw-2rem))] flex-col items-start gap-2 rounded-2xl border border-white/15 bg-background/90 p-3 text-left shadow-xl backdrop-blur-md">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Elegir una nueva imagen de portada"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {isUploading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
        {isUploading ? "Actualizando portada…" : "Cambiar portada"}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">Tamaño recomendado: 1920 × 900 px. En celulares se recortan los laterales; dejá lo importante centrado. JPG, PNG o WebP; hasta 5 MB.</p>
    </div>
  )
}

