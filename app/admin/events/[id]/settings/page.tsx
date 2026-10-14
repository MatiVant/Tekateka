"use client"

import { useParams } from "next/navigation"
import { TicketTiersManager } from "@/components/admin/ticket-tiers-manager"
import { PromotionCodesManager } from "@/components/admin/promotion-codes-manager"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Edit } from "lucide-react"
import Link from "next/link"

export default function EventSettingsPage() {
  const params = useParams()
  const eventId = params.id as string

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium uppercase tracking-wide text-primary">Administración</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Configuración del evento</h1>
          <p className="mt-2 text-sm text-muted-foreground">Gestioná tipos de entrada y códigos de promoción desde un mismo lugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <Link href={`/admin/events/${eventId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar Evento
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="w-fit" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Panel
            </Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl p-4 shadow-sm sm:p-6">
        <TicketTiersManager eventId={eventId} />
      </Card>

      <Card className="rounded-2xl p-4 shadow-sm sm:p-6">
        <PromotionCodesManager eventId={eventId} />
      </Card>
    </div>
  )
}
