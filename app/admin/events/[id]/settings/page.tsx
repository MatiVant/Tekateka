"use client"

import { useParams } from "next/navigation"
import { TicketTiersManager } from "@/components/admin/ticket-tiers-manager"
import { PromotionCodesManager } from "@/components/admin/promotion-codes-manager"
import { Card } from "@/components/ui/card"

export default function EventSettingsPage() {
  const params = useParams()
  const eventId = params.id as string

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl p-4 shadow-sm sm:p-6">
        <TicketTiersManager eventId={eventId} />
      </Card>

      <Card className="rounded-2xl p-4 shadow-sm sm:p-6">
        <PromotionCodesManager eventId={eventId} />
      </Card>
    </div>
  )
}
