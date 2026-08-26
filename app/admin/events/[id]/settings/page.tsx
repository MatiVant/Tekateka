"use client"

import { useParams, useRouter } from "next/navigation"
import { TicketTiersManager } from "@/components/admin/ticket-tiers-manager"
import { PromotionCodesManager } from "@/components/admin/promotion-codes-manager"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Edit } from "lucide-react"
import Link from "next/link"

export default function EventSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Configuración del Evento</h1>
          <p className="text-muted-foreground">Gestiona tipos de entrada y promociones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/events/${eventId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar Evento
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Panel
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <TicketTiersManager eventId={eventId} />
      </Card>

      <Card className="p-6">
        <PromotionCodesManager eventId={eventId} />
      </Card>
    </div>
  )
}
