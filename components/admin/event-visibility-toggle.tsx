"use client"

import { useState } from "react"
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
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      const result = await setEventVisibility(eventId, !isPublic)
      if (!result.success) {
        toast({
          title: "No se pudo cambiar la visibilidad",
          description: result.error || "Intentá nuevamente.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: isPublic ? "Evento oculto" : "Evento publicado",
        description: isPublic
          ? "Ya no aparecerá en el inicio ni en la página pública del espacio."
          : "Ahora aparece en las páginas públicas del espacio y en el inicio.",
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

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      aria-label={isPublic ? "Ocultar evento de las páginas públicas" : "Mostrar evento en las páginas públicas"}
      aria-busy={isLoading}
    >
      {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : isPublic ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
      {isPublic ? "Ocultar" : "Mostrar"}
    </Button>
  )
}
