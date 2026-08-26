"use client"

import { Button } from "@/components/ui/button"
import { Archive, ArchiveRestore } from "lucide-react"
import { archiveEvent, unarchiveEvent } from "@/app/actions/archive-event"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

interface ArchiveEventButtonProps {
  eventId: string
  isArchived: boolean
}

export function ArchiveEventButton({ eventId, isArchived }: ArchiveEventButtonProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleToggleArchive = async () => {
    setIsLoading(true)

    const result = isArchived ? await unarchiveEvent(eventId) : await archiveEvent(eventId)

    if (result.success) {
      toast({
        title: isArchived ? "Evento reactivado" : "Evento archivado",
        description: isArchived
          ? "El evento ha sido reactivado correctamente"
          : "El evento ha sido archivado correctamente",
      })
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo completar la operación",
        variant: "destructive",
      })
    }

    setIsLoading(false)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleToggleArchive} disabled={isLoading}>
      {isArchived ? (
        <>
          <ArchiveRestore className="mr-1 h-3 w-3" />
          Reactivar
        </>
      ) : (
        <>
          <Archive className="mr-1 h-3 w-3" />
          Archivar
        </>
      )}
    </Button>
  )
}
