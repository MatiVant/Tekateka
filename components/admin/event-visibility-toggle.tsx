"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { setEventVisibility } from "@/app/actions/set-event-visibility"

interface EventVisibilityToggleProps {
  eventId: string
  isPublic: boolean
}

export function EventVisibilityToggle({ eventId, isPublic }: EventVisibilityToggleProps) {
  const [isVisible, setIsVisible] = useState(isPublic)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  useEffect(() => setIsVisible(isPublic), [isPublic])
  const { toast } = useToast()

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      const result = await setEventVisibility(eventId, !isVisible)
      if (!result.success) {
        toast({
          title: "No se pudo cambiar la visibilidad",
          description: result.error || "Intentá nuevamente.",
          variant: "destructive",
        })
        return
      }

      const nextVisible = !isVisible
      setIsVisible(nextVisible)
      toast({
        title: nextVisible ? "Evento publicado" : "Evento oculto",
        description: nextVisible
          ? "Ahora aparece en las páginas públicas del espacio y en el inicio."
          : "Ya no aparecerá en el inicio ni en la página pública del espacio.",
      })
      router.refresh()
    } catch {
      toast({
        title: "No se pudo cambiar la visibilidad",
        description: "Revisá tu conexión e intentá nuevamente.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const actionLabel = isVisible ? "Ocultar evento de las páginas públicas" : "Mostrar evento en las páginas públicas"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={isLoading}
      title={actionLabel}
      aria-label={actionLabel}
      aria-pressed={isVisible}
      aria-busy={isLoading}
    >
      {isLoading ? <Loader2 className="size-4 animate-spin" /> : isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
    </Button>
  )
}
