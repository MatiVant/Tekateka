"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, XCircle, Clock, Search, Eye, ExternalLink, FileText, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/format"
import { handleNetworkError } from "@/lib/network-error-handler"
import { useToast } from "@/hooks/use-toast"
import { getPaymentStatusLabel } from "@/lib/payment-status"

interface TicketPromotion {
  id: string
  promotion_code_id: string
  original_price: number
  discount_amount: number
  final_price: number
  promotion_codes: {
    code: string
    promotion_type: string
    discount_value: number
  }
}

interface TicketTier {
  id: string
  name: string
}

interface Ticket {
  id: string
  buyer_name: string
  buyer_email: string
  qr_code: string
  status: string
  payment_status?: "pending" | "submitted" | "approved" | "rejected"
  purchased_at: string
  payment_receipt_url?: string
  payment_notes?: string
  rejection_reason?: string
  tier_id?: string
  final_price?: number
  payment_method?: "mercado_pago" | "external_link" | "transfer" | "free" | null
  charged_amount?: number
  payment_fee_amount?: number
  net_amount?: number
  events: {
    id: string
    title: string
    price: number
  }
  ticket_tiers?: TicketTier | null
  ticket_promotions?: TicketPromotion[]
}

interface AllTicketsTableProps {
  tickets: Ticket[] | undefined
}

export function AllTicketsTable({ tickets }: AllTicketsTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null)

  const filteredTickets = useMemo(() => {
    if (!tickets || !Array.isArray(tickets)) return []
    if (!searchTerm.trim()) return tickets

    const search = searchTerm.toLowerCase()
    return tickets.filter(
      (ticket) =>
        ticket.buyer_name.toLowerCase().includes(search) ||
        ticket.buyer_email.toLowerCase().includes(search) ||
        ticket.qr_code.toLowerCase().includes(search) ||
        ticket.events.title.toLowerCase().includes(search),
    )
  }, [tickets, searchTerm])

  if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No hay tickets vendidos aún</div>
  }

  const handleVerifyPayment = async (ticketId: string) => {
    setLoadingId(ticketId)
    try {
      const response = await fetch("/api/mercadopago/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo consultar Mercado Pago")
      toast({ title: result.status === "approved" ? "Pago confirmado" : "Estado actualizado", description: result.status === "not_found" ? result.message : `Mercado Pago informó: ${result.mpStatus}` })
      router.refresh()
      setIsDialogOpen(false)
    } catch (error) {
      toast({ title: "No se pudo verificar el pago", description: error instanceof Error ? error.message : "Intentá nuevamente.", variant: "destructive" })
    } finally {
      setLoadingId(null)
    }
  }

  const handleResendPaymentLink = async (ticketId: string) => {
    setLoadingId(ticketId)
    try {
      const response = await fetch("/api/resend-payment-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo reenviar el enlace")
      toast({ title: "Enlace reenviado", description: "El comprador recibirá un nuevo enlace para continuar el pago." })
    } catch (error) {
      toast({ title: "No se pudo reenviar", description: error instanceof Error ? error.message : "Intentá nuevamente.", variant: "destructive" })
    } finally {
      setLoadingId(null)
    }
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setLoadingId(ticketId)
    try {
      if (newStatus === "confirmed") {
        const response = await fetch("/api/confirm-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId }),
        }).catch((err) => {
          handleNetworkError(err)
          throw err
        })

        if (!response.ok) throw new Error("Error al confirmar ticket")
      } else {
        const supabase = createClient()
        const { error } = await supabase.from("tickets").update({ status: newStatus }).eq("id", ticketId)

        if (error) throw error
      }

      router.refresh()
    } catch (error) {
      console.error("[v0] Error al actualizar ticket:", error)
      if (!(error instanceof TypeError)) {
        handleNetworkError(error, "Error al actualizar el estado del ticket")
      }
    } finally {
      setLoadingId(null)
    }
  }

  const handleRejectWithReason = async () => {
    if (!selectedTicket || !rejectionReason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor ingresa un motivo para el rechazo",
      })
      return
    }

    setLoadingId(selectedTicket.id)
    try {
      const response = await fetch("/api/reject-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          reason: rejectionReason,
        }),
      }).catch((err) => {
        handleNetworkError(err)
        throw err
      })

      if (!response.ok) throw new Error("Error al rechazar ticket")

      setIsRejectDialogOpen(false)
      setIsDialogOpen(false)
      setRejectionReason("")
      router.refresh()
    } catch (error) {
      console.error("[v0] Error al rechazar ticket:", error)
      if (!(error instanceof TypeError)) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al rechazar el ticket. Por favor intenta nuevamente.",
        })
      }
    } finally {
      setLoadingId(null)
    }
  }

  const viewTicketDetails = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setIsDialogOpen(true)
  }

  const viewReceipt = (receiptUrl: string) => {
    setSelectedReceipt(receiptUrl)
    setIsReceiptDialogOpen(true)
  }

  const getPaymentBadge = (status?: Ticket["payment_status"]) => {
    const className = status === "approved" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : status === "rejected" ? "bg-rose-100 text-rose-800 border-rose-200" : status === "submitted" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-muted text-muted-foreground"
    return <Badge variant="outline" className={className}>{getPaymentStatusLabel(status)}</Badge>
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            Confirmada
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pendiente
          </Badge>
        )
      case "used":
        return <Badge variant="outline">Usada</Badge>
      case "cancelled":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Cancelada
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, código QR o evento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-xs">Evento</th>
                <th className="text-left p-4 font-medium text-xs">Comprador</th>
                <th className="text-left p-4 font-medium text-xs">Tipo</th>
                <th className="text-left p-4 font-medium text-xs">Promoción</th>
                <th className="text-left p-4 font-medium text-xs">Precio</th>
                <th className="text-left p-4 font-medium text-xs">Medio de pago</th>
                <th className="text-left p-4 font-medium text-xs">Estado</th>
                <th className="text-left p-4 font-medium text-xs">Pago</th>
                <th className="text-left p-4 font-medium text-xs">Comprobante</th>
                <th className="text-left p-4 font-medium text-xs">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="border-t hover:bg-muted/30 text-sm">
                  <td className="p-4 font-medium">{ticket.events.title}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{ticket.buyer_name}</span>
                      <span className="text-xs text-muted-foreground">{ticket.buyer_email}</span>
                    </div>
                  </td>
                  <td className="p-4 text-xs">
                    {ticket.ticket_tiers?.name ? (
                      <Badge variant="outline">{ticket.ticket_tiers.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">General</span>
                    )}
                  </td>
                  <td className="p-4 text-xs">
                    {ticket.ticket_promotions && ticket.ticket_promotions.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {ticket.ticket_promotions.map((promo) => (
                          <Badge key={promo.id} variant="secondary" className="text-xs">
                            {promo.promotion_codes.code}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
  <td className="p-4 font-semibold">{formatCurrency(ticket.final_price || ticket.events.price)}</td>
  <td className="p-4 text-xs">{ticket.payment_method === "mercado_pago" ? "Mercado Pago (+8%)" : ticket.payment_method === "external_link" ? "Link MP" : ticket.payment_method === "transfer" ? "Transferencia" : ticket.payment_method === "free" ? "Gratis" : "—"}</td>
  <td className="p-4">{getStatusBadge(ticket.status)}</td>
                  <td className="p-4">{getPaymentBadge(ticket.payment_status)}</td>
                  <td className="p-4">
                    {ticket.payment_receipt_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewReceipt(ticket.payment_receipt_url!)}
                        title="Ver comprobante"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <Button size="sm" variant="ghost" onClick={() => viewTicketDetails(ticket)} title="Ver detalles">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTickets.length === 0 && searchTerm && (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron tickets que coincidan con la búsqueda
          </div>
        )}

        <div className="flex justify-between items-center p-4 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground mb-1">Total de tickets</p>
            <p className="text-2xl font-bold">{tickets.length}</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-sm text-muted-foreground">Total confirmados</p>
            <p className="text-2xl font-bold text-green-600">
              {tickets.filter((t) => t.status === "confirmed").length}
            </p>
          </div>
        </div>
      </div>

      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comprobante de Pago</DialogTitle>
          </DialogHeader>

          {selectedReceipt && (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <img
                  src={selectedReceipt || "/placeholder.svg"}
                  alt="Comprobante de pago"
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              </div>
              <Button variant="outline" size="sm" asChild className="w-full bg-transparent">
                <a href={selectedReceipt} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir en nueva pestaña
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de la Entrada</DialogTitle>
            <DialogDescription>
              Información completa del ticket, tipo, promoción y comprobante de pago
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Comprador</p>
                  <p className="font-medium">{selectedTicket.buyer_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedTicket.buyer_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Evento</p>
                  <p className="font-medium">{selectedTicket.events.title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tipo de Entrada</p>
                  <p className="font-medium">{selectedTicket.ticket_tiers?.name || "General"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estado</p>
                  {getStatusBadge(selectedTicket.status)}
                </div>
              </div>

              {selectedTicket.ticket_promotions && selectedTicket.ticket_promotions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Promoción Aplicada</p>
                  {selectedTicket.ticket_promotions.map((promo) => (
                    <div key={promo.id} className="space-y-1 text-sm">
                      <p>
                        <strong>Código:</strong> {promo.promotion_codes.code}
                      </p>
                      <p>
                        <strong>Tipo:</strong> {promo.promotion_codes.promotion_type}
                      </p>
                      <p>
                        <strong>Descuento:</strong> {formatCurrency(promo.discount_amount)}
                      </p>
                      <p>
                        <strong>Precio Final:</strong> {formatCurrency(promo.final_price)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-muted/50 border rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Resumen de Precios</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Precio Original:</span>
                    <span>{formatCurrency(selectedTicket.events.price)}</span>
                  </div>
                  {selectedTicket.ticket_promotions && selectedTicket.ticket_promotions.length > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Descuento:</span>
                      <span>-{formatCurrency(selectedTicket.ticket_promotions[0].discount_amount)}</span>
                    </div>
                  )}
  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
  <span>Total cobrado:</span>
  <span>{formatCurrency(selectedTicket.charged_amount ?? selectedTicket.final_price ?? selectedTicket.events.price)}</span>
  </div>
  <div className="flex justify-between text-sm"><span>Gastos / comisión:</span><span>{formatCurrency(selectedTicket.payment_fee_amount ?? 0)}</span></div>
  <div className="flex justify-between text-sm"><span>Neto:</span><span>{formatCurrency(selectedTicket.net_amount ?? selectedTicket.final_price ?? selectedTicket.events.price)}</span></div>
                </div>
              </div>

              {selectedTicket.payment_notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notas del comprador</p>
                  <p className="text-sm bg-muted p-3 rounded">{selectedTicket.payment_notes}</p>
                </div>
              )}

              {selectedTicket.payment_receipt_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Comprobante de Pago</p>
                  <div className="border rounded-lg overflow-hidden">
                    <img
                      src={selectedTicket.payment_receipt_url || "/placeholder.svg"}
                      alt="Comprobante de pago"
                      className="w-full h-auto"
                    />
                  </div>
                  <Button variant="outline" size="sm" asChild className="mt-2 bg-transparent">
                    <a href={selectedTicket.payment_receipt_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir en nueva pestaña
                    </a>
                  </Button>
                </div>
              )}

              {selectedTicket.rejection_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm font-medium text-destructive mb-1">Motivo del rechazo</p>
                  <p className="text-sm">{selectedTicket.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
  {selectedTicket?.status === "pending" && (
  <>
  {(selectedTicket.payment_method === "mercado_pago" || selectedTicket.payment_method === "external_link" || selectedTicket.payment_provider === "mercadopago") && <Button variant="outline" onClick={() => handleVerifyPayment(selectedTicket.id)} disabled={loadingId === selectedTicket.id}>
  <ExternalLink className="mr-2 h-4 w-4" />
  Verificar en Mercado Pago
  </Button>}
  <Button variant="outline" onClick={() => handleResendPaymentLink(selectedTicket.id)} disabled={loadingId === selectedTicket.id}>
  <Mail className="mr-2 h-4 w-4" />
  Reenviar enlace de pago
  </Button>
                <Button
                  onClick={() => {
                    handleStatusChange(selectedTicket.id, "confirmed")
                    setIsDialogOpen(false)
                  }}
                  disabled={loadingId === selectedTicket.id}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Entrada
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsRejectDialogOpen(true)
                  }}
                  disabled={loadingId === selectedTicket.id}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rechazar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Entrada</DialogTitle>
            <DialogDescription>
              Ingresa el motivo del rechazo. El comprador recibirá un email con esta información.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Motivo del rechazo</label>
              <Textarea
                placeholder="Ej: El comprobante de pago no coincide con el monto del ticket..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false)
                setRejectionReason("")
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectWithReason}
              disabled={!rejectionReason.trim() || loadingId === selectedTicket?.id}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Rechazar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
