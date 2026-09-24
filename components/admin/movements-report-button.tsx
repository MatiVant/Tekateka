"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MovementsTable } from "@/components/admin/movements-table"
import { BarChart3 } from "lucide-react"

type Movement = Parameters<typeof MovementsTable>[0]["movements"][number]

export function MovementsReportButton({ movements, showOrganizer = false }: { movements: Movement[]; showOrganizer?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BarChart3 className="mr-2 h-4 w-4" />
        Ver informe de movimientos
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Movimientos de mis eventos</DialogTitle>
            <DialogDescription>Actividad de tickets y pagos únicamente de tus eventos.</DialogDescription>
          </DialogHeader>
          <MovementsTable movements={movements} showOrganizer={showOrganizer} />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default MovementsReportButton
