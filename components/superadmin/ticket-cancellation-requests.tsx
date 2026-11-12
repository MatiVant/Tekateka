"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export type TicketCancellationRequest = {
  id: string
  buyer_name: string
  buyer_email: string
  cancellation_request_reason: string | null
  cancellation_requested_at: string | null
  events: { title: string } | { title: string }[] | null
  organizer: { full_name: string | null; email: string | null } | null
}

export function TicketCancellationRequests({ requests }: { requests: TicketCancellationRequest[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const review = async (ticketId: string, action: "approve" | "reject") => {
    setLoadingId(ticketId)
    try {
      const response = await fetch("/api/superadmin/ticket-cancellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, action }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || "No se pudo procesar la solicitud")
      toast({ title: action === "approve" ? "Reversión aprobada" : "Solicitud rechazada", description: result.message })
      router.refresh()
    } catch (error) {
      toast({ title: "No se pudo procesar", description: error instanceof Error ? error.message : "Error inesperado", variant: "destructive" })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Solicitudes de reversión <Badge variant="secondary">{requests.length}</Badge></CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p> : (
          <div className="space-y-4">
            {requests.map((request) => {
              const event = Array.isArray(request.events) ? request.events[0] : request.events
              const busy = loadingId === request.id
              return (
                <div key={request.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{event?.title || "Evento"} · {request.buyer_name}</p>
                      <p className="text-sm text-muted-foreground">{request.buyer_email} · Solicitó: {request.organizer?.full_name || request.organizer?.email || "Organizador"}</p>
                      <p className="mt-2 text-sm"><span className="font-medium">Motivo:</span> {request.cancellation_request_reason || "Sin motivo"}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => review(request.id, "reject")}><X className="mr-1 size-4" />Rechazar</Button>
                      <Button size="sm" disabled={busy} onClick={() => review(request.id, "approve")}><Check className="mr-1 size-4" />Aprobar</Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
