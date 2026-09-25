"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCircle, XCircle, Clock, Search, Eye, ExternalLink, FileText, Mail, Filter, MessageCircle, Send, Printer } from "lucide-react"
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
import { AdminReceiptUpload } from "@/components/admin/admin-receipt-upload"

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
  buyer_phone?: string | null
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
  payment_provider?: string | null
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

interface EventOption {
  id: string
  title: string
}

interface AllTicketsTableProps {
  tickets: Ticket[] | undefined
  events?: EventOption[]
}

export function AllTicketsTable({ tickets, events }: AllTicketsTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEventId, setSelectedEventId] = useState("all")
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkRejectDialogOpen, setIsBulkRejectDialogOpen] = useState(false)
  const [bulkRejectionReason, setBulkRejectionReason] = useState("")

  const openWhatsApp = (ticket: Ticket) => {
    if (!ticket.buyer_phone) return
    const phone = ticket.buyer_phone.replace(/[^\\d+]/g, "").replace(/^00/, "+")
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone.startsWith("54") ? phone : `54${phone.replace(/^0/, "")}`
    const message = `Hola ${ticket.buyer_name}, te escribimos por tu entrada para ${ticket.events.title}.`
    window.open(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer")
  }

  const eventOptions = useMemo<EventOption[]>(() => {
    if (events && events.length > 0) return events
    const map = new Map<string, EventOption>()
    ;(tickets ?? []).forEach((ticket) => {
      if (ticket.events?.id) map.set(ticket.events.id, { id: ticket.events.id, title: ticket.events.title })
    })
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title))
  }, [events, tickets])

  const filteredTickets = useMemo(() => {
    if (!tickets || !Array.isArray(tickets)) return []
    let result = tickets

    if (selectedEventId !== "all") {
      result = result.filter((ticket) => ticket.events?.id === selectedEventId)
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase()
      result = result.filter(
        (ticket) =>
          ticket.buyer_name.toLowerCase().includes(search) ||
          ticket.buyer_email.toLowerCase().includes(search) ||
          ticket.qr_code.toLowerCase().includes(search) ||
          ticket.events.title.toLowerCase().includes(search),
      )
    }

    return result
  }, [tickets, searchTerm, selectedEventId])

  const toggleSelected = (ticketId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(ticketId)
      else next.delete(ticketId)
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredTickets.map((t) => t.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const allVisibleSelected = filteredTickets.length > 0 && filteredTickets.every((t) => selectedIds.has(t.id))

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setIsBulkLoading(true)
    try {
      const result = await fetch("/api/confirm-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketIds: ids }),
      })
      const failed = result.ok ? 0 : 1
      toast({
        title: failed === 0 ? "Entradas confirmadas" : "Confirmación parcial",
        description:
          failed === 0
            ? `${ids.length} entrada(s) confirmada(s) correctamente.`
            : `${ids.length - failed} confirmada(s), ${failed} con error.`,
        variant: failed === 0 ? "default" : "destructive",
      })
      setSelectedIds(new Set())
      router.refresh()
    } catch (error) {
      handleNetworkError(error, "Error al confirmar las entradas seleccionadas")
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleBulkReject = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0 || !bulkRejectionReason.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Ingresa un motivo para el rechazo" })
      return
    }
    setIsBulkLoading(true)
    try {
      const results = await Promise.all(
        ids.map((id) =>
          fetch("/api/reject-ticket", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticketId: id, reason: bulkRejectionReason }),
          }),
        ),
      )
      const failed = results.filter((r) => !r.ok).length
      toast({
        title: failed === 0 ? "Entradas rechazadas" : "Rechazo parcial",
        description:
          failed === 0
            ? `${ids.length} entrada(s) rechazada(s) correctamente.`
            : `${ids.length - failed} rechazada(s), ${failed} con error.`,
        variant: failed === 0 ? "default" : "destructive",
      })
      setSelectedIds(new Set())
      setIsBulkRejectDialogOpen(false)
      setBulkRejectionReason("")
      router.refresh()
    } catch (error) {
      handleNetworkError(error, "Error al rechazar las entradas seleccionadas")
    } finally {
      setIsBulkLoading(false)
    }
  }

  if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No hay tickets vendidos a��n</div>
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

  const handleBulkResendTickets = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const selected = tickets.filter((ticket) => selectedIds.has(ticket.id))
    const sameBuyer = selected.every((ticket) => ticket.buyer_email === selected[0]?.buyer_email && ticket.events?.id === selected[0]?.events?.id)
    if (!sameBuyer) { toast({ title: "No se pueden agrupar", description: "Seleccioná entradas del mismo comprador y evento.", variant: "destructive" }); return }
    setIsBulkLoading(true)
    try {
      const response = await fetch("/api/resend-ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketIds: ids }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo reenviar")
      toast({ title: "Entradas reenviadas", description: `Se envió un solo email con ${ids.length} entradas.` })
      setSelectedIds(new Set())
    } catch (error) { toast({ title: "No se pudo reenviar", description: error instanceof Error ? error.message : "Intentá nuevamente.", variant: "destructive" }) } finally { setIsBulkLoading(false) }
  }

  const handleResendTicket = async (ticketId: string) => {
  setLoadingId(ticketId)
  try {
  const response = await fetch("/api/resend-ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || "No se pudo reenviar la entrada")
  toast({ title: "Entrada reenviada", description: "El email con el QR fue enviado nuevamente al comprador." })
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
      <div className="admin-ticket-screen space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Buscar por nombre, email, código QR o evento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Filtrar por evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los eventos</SelectItem>
                {eventOptions.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={() => window.print()} disabled={filteredTickets.length === 0} title="Imprimir o guardar la lista como PDF">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir lista
          </Button>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <span className="text-sm font-medium">{selectedIds.size} entrada(s) seleccionada(s)</span>
  <Button size="sm" onClick={handleBulkApprove} disabled={isBulkLoading}>
  <CheckCircle className="mr-2 h-4 w-4" />
  Aprobar seleccionadas
  </Button>
  <Button size="sm" variant="outline" onClick={handleBulkResendTickets} disabled={isBulkLoading}>
  <Send className="mr-2 h-4 w-4" />
  Reenviar juntas
  </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setIsBulkRejectDialogOpen(true)}
              disabled={isBulkLoading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Rechazar seleccionadas
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={isBulkLoading}>
              Limpiar selección
            </Button>
          </div>
        )}

        <div className="space-y-3 md:hidden">
          {filteredTickets.map((ticket) => (
            <article key={ticket.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Checkbox checked={selectedIds.has(ticket.id)} onCheckedChange={(checked) => toggleSelected(ticket.id, Boolean(checked))} aria-label={`Seleccionar entrada de ${ticket.buyer_name}`} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 truncate font-semibold">{ticket.buyer_name}</h3>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{ticket.buyer_email}</p>
                  <p className="mt-3 text-sm font-medium">{ticket.events.title}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Tipo: <strong className="text-foreground">{ticket.ticket_tiers?.name || "General"}</strong></span>
                    <span>Pago: <strong className="text-foreground">{ticket.payment_status || "—"}</strong></span>
                    <span>Precio: <strong className="text-foreground">{Number(ticket.final_price) === 0 ? "Gratis" : formatCurrency(ticket.final_price ?? ticket.events.price)}</strong></span>
                    <span>Medio: <strong className="text-foreground">{ticket.payment_method === "free" ? "Gratis" : ticket.payment_method || "—"}</strong></span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {ticket.payment_receipt_url ? <Button variant="outline" size="sm" className="flex-1" onClick={() => viewReceipt(ticket.payment_receipt_url!)}><FileText className="mr-2 h-4 w-4" />Comprobante</Button> : Number(ticket.final_price) > 0 && ticket.payment_method !== "free" ? <AdminReceiptUpload ticketId={ticket.id} /> : null}
                    <Button size="sm" className="flex-1" onClick={() => viewTicketDetails(ticket)}><Eye className="mr-2 h-4 w-4" />Detalles</Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                    aria-label="Seleccionar todas las entradas visibles"
                  />
                </th>
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
                  <td className="p-4">
                    <Checkbox
                      checked={selectedIds.has(ticket.id)}
                      onCheckedChange={(checked) => toggleSelected(ticket.id, Boolean(checked))}
                      aria-label={`Seleccionar entrada de ${ticket.buyer_name}`}
                    />
                  </td>
                  <td className="p-4 font-medium">{ticket.events.title}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{ticket.buyer_name}</span>
                      <span className="text-xs text-muted-foreground">{ticket.buyer_email}</span>
                      {ticket.buyer_phone && <span className="text-xs text-muted-foreground">Tel: {ticket.buyer_phone}</span>}
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
                            {promo.promotion_codes.promotion_type === "protocol" || ticket.final_price === 0 ? `${promo.promotion_codes.code} · Gratis` : `${promo.promotion_codes.code} · Descuento`}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
  <td className="p-4 font-semibold">{Number(ticket.final_price) === 0 ? <Badge variant="secondary">Gratis</Badge> : formatCurrency(ticket.final_price ?? ticket.events.price)}</td>
  <td className="p-4 text-xs">{ticket.payment_method === "mercado_pago" ? "Mercado Pago (+10%)" : ticket.payment_method === "external_link" ? "Link MP" : ticket.payment_method === "transfer" ? "Transferencia" : ticket.payment_method === "free" ? "Gratis" : "—"}</td>
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
                      Number(ticket.final_price) > 0 && ticket.payment_method !== "free" ? <AdminReceiptUpload ticketId={ticket.id} /> : null
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => viewTicketDetails(ticket)} title="Ver detalles">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {ticket.buyer_phone && <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700" onClick={() => openWhatsApp(ticket)} title={`Escribir por WhatsApp a ${ticket.buyer_name}`}>
                        <MessageCircle className="h-4 w-4" />
                        <span className="sr-only">Escribir por WhatsApp</span>
                      </Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTickets.length === 0 && (searchTerm || selectedEventId !== "all") && (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron tickets que coincidan con los filtros
          </div>
        )}

  <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-5">
  <div><p className="text-sm text-muted-foreground">Total histórico</p><p className="text-2xl font-bold">{tickets.length}</p></div>
  <div><p className="text-sm text-muted-foreground">Confirmados</p><p className="text-2xl font-bold text-green-600">{tickets.filter((t) => t.status === "confirmed").length}</p></div>
  <div><p className="text-sm text-muted-foreground">Recaudación histórica</p><p className="text-xl font-bold">{formatCurrency(tickets.reduce((total, ticket) => total + (Number(ticket.charged_amount ?? ticket.final_price ?? ticket.events.price) || 0), 0))}</p></div>
  <div><p className="text-sm text-muted-foreground">Gratis</p><p className="text-2xl font-bold">{tickets.filter((t) => Number(t.final_price) === 0 || t.payment_method === "free").length}</p></div>
  <div><p className="text-sm text-muted-foreground">Con descuento</p><p className="text-2xl font-bold">{tickets.filter((t) => Number(t.final_price) > 0 && Boolean(t.ticket_promotions?.length)).length}</p></div>
  </div>
      </div>

      <section className="ticket-export-print">
        <h1 style={{ margin: 0, fontSize: 20 }}>Entradas</h1>
        <p style={{ margin: "4px 0 14px", color: "#555", fontSize: 12 }}>{selectedEventId !== "all" ? eventOptions.find((event) => event.id === selectedEventId)?.title ?? "" : "Lista filtrada"}</p>
        <div style={{ borderTop: "1px solid #222", fontSize: 12 }}>
          {filteredTickets.map((ticket, index) => {
            const isTwoForOne = ticket.ticket_promotions?.some((promotion) => promotion.promotion_codes.promotion_type === "two_for_one")
            const isFree = ticket.payment_method === "free" || Number(ticket.final_price) === 0
            const status = ticket.status === "confirmed" || ticket.payment_status === "approved" ? "Confirmada" : "Sin confirmar"
            return <div key={ticket.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr 130px 78px 92px", gap: 8, padding: "7px 0", borderBottom: "1px solid #ddd", alignItems: "center" }}><span>{index + 1}</span><strong>{ticket.buyer_name}</strong><span style={{ fontFamily: "monospace" }}>{ticket.qr_code}</span><span>{isFree ? "Gratis" : isTwoForOne ? "2x1" : "Paga"}</span><span>{status}</span></div>
          })}
        </div>
        <p style={{ marginTop: 12, fontSize: 11, color: "#555" }}>{filteredTickets.length} entrada(s)</p>
      </section>

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
            {selectedTicket.buyer_phone && <><p className="text-sm text-muted-foreground">Tel: {selectedTicket.buyer_phone}</p><Button type="button" size="sm" variant="outline" className="mt-2 text-green-600 hover:text-green-700" onClick={() => openWhatsApp(selectedTicket)}><MessageCircle className="mr-2 h-4 w-4" />Escribir por WhatsApp</Button></>}
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
          {selectedTicket?.status === "confirmed" && <Button variant="outline" onClick={() => handleResendTicket(selectedTicket.id)} disabled={loadingId === selectedTicket.id}>
          <Mail className="mr-2 h-4 w-4" />
          Reenviar entrada con QR
          </Button>}
          {selectedTicket && (selectedTicket.payment_method === "mercado_pago" || selectedTicket.payment_method === "external_link" || selectedTicket.payment_provider === "mercadopago") && <Button variant="outline" onClick={() => handleVerifyPayment(selectedTicket.id)} disabled={loadingId === selectedTicket.id}>
  <ExternalLink className="mr-2 h-4 w-4" />
  Verificar en Mercado Pago
  </Button>}
  {selectedTicket?.status === "pending" && (
  <>
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

      <Dialog open={isBulkRejectDialogOpen} onOpenChange={setIsBulkRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar {selectedIds.size} entrada(s)</DialogTitle>
            <DialogDescription>
              Ingresa el motivo del rechazo. Cada comprador recibirá un email con esta información.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Motivo del rechazo</label>
              <Textarea
                placeholder="Ej: El comprobante de pago no coincide con el monto del ticket..."
                value={bulkRejectionReason}
                onChange={(e) => setBulkRejectionReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkRejectDialogOpen(false)
                setBulkRejectionReason("")
              }}
              disabled={isBulkLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkReject}
              disabled={!bulkRejectionReason.trim() || isBulkLoading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Rechazar {selectedIds.size} entrada(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
