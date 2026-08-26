"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { deleteEvent } from "@/app/actions/delete-event"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface DeleteEventButtonProps {
  eventId: string
  eventTitle: string
}

export function DeleteEventButton({ eventId, eventTitle }: DeleteEventButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const result = await deleteEvent(eventId)

      if (result.success) {
        toast({
          title: "Evento eliminado",
          description: "El evento ha sido eliminado correctamente",
        })
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar el evento",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error inesperado al eliminar el evento",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full">
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar Evento
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción eliminará permanentemente el evento <strong>{eventTitle}</strong> y todos sus tickets, tipos de
            entrada y códigos promocionales asociados. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
