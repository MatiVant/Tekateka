"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createTicket } from "@/app/actions/create-ticket"
import { updateTicketReceipt } from "@/app/actions/update-ticket-receipt"
import { formatCurrency } from "@/lib/format"
import { handleNetworkError } from "@/lib/network-error-handler"

interface TicketTier {
  id: string
  name: string
  base_price: number
  available_quantity: number
}

interface PurchaseFlowProps {
  eventId: string
  eventTitle: string
  eventPrice: number
  paymentInstructions?: string
  paymentMethods?: string[] | null
  mercadoPagoLink?: string | null
  isFree?: boolean
  isPwyw?: boolean
}

type Step = "tiers" | "form" | "payment" | "receipt" | "success"
type PaymentMethod = "mercado_pago" | "external_link" | "transfer"

export function PurchaseFlow({
  eventId,
  eventTitle,
  eventPrice,
  paymentInstructions,
  paymentMethods,
  mercadoPagoLink,
  isFree = false,
  isPwyw = false,
}: PurchaseFlowProps) {
  const [step, setStep] = useState<Step>("form")
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [ticketIds, setTicketIds] = useState<string[]>([])
  const [tiers, setTiers] = useState<TicketTier[]>([])
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [promotionCode, setPromotionCode] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [maxTicketsPerPerson, setMaxTicketsPerPerson] = useState<number | null>(null)

  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptNotes, setReceiptNotes] = useState("")
  const [uploading, setUploading] = useState(false)
  const [tierLoading, setTierLoading] = useState(true)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finalPrice, setFinalPrice] = useState(eventPrice)
  const [discountApplied, setDiscountApplied] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null)
  const availablePaymentMethods = paymentMethods?.length ? paymentMethods : [mercadoPagoLink ? "external_link" : "mercado_pago"]
  const defaultPaymentMethod: PaymentMethod = availablePaymentMethods.includes("transfer") ? "transfer" : mercadoPagoLink ? "external_link" : "mercado_pago"
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPaymentMethod)
  const [customPrice, setCustomPrice] = useState(eventPrice.toString())
  const router = useRouter()

  const supabase = createClient()

  useEffect(() => {
    fetchTiers()
    fetchEventMaxTickets()
    const payment = new URLSearchParams(window.location.search).get("payment")
    if (payment === "success") {
      setPaymentNotice("Pago recibido. Estamos confirmando tu compra; revisá tu email para recibir las entradas.")
      setStep("success")
    } else if (payment === "pending") {
      setPaymentNotice("El pago quedó pendiente. Te avisaremos por email cuando Mercado Pago lo confirme.")
      setStep("success")
    } else if (payment === "failure") {
      setPaymentNotice("El pago no se completó. Podés volver e intentarlo nuevamente.")
    }
  }, [eventId])

  const fetchTiers = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("ticket_tiers")
        .select("id, name, base_price, available_quantity")
        .eq("event_id", eventId)
        .order("tier_order", { ascending: true })

      if (fetchError) throw fetchError
      setTiers(data || [])
      if (data && data.length > 0) {
        setStep("tiers")
        setSelectedTierId(data[0].id)
        setFinalPrice(data[0].base_price)
      } else {
        setFinalPrice(eventPrice)
      }
    } catch (error) {
      console.error("[v0] Error fetching tiers:", error)
      setTiers([])
      setFinalPrice(eventPrice)
    } finally {
      setTierLoading(false)
    }
  }

  const fetchEventMaxTickets = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("max_tickets_per_person")
        .eq("id", eventId)
        .single()

      if (fetchError) throw fetchError
      setMaxTicketsPerPerson(data?.max_tickets_per_person || null)
    } catch (error) {
      console.error("[v0] Error fetching max tickets:", error)
    }
  }

  const validatePromotion = async () => {
    if (!promotionCode.trim()) {
      setError(null)
      setDiscountApplied(false)
      const selectedTier = tiers.find((t) => t.id === selectedTierId)
      setFinalPrice(selectedTier?.base_price || eventPrice)
      return
    }

    try {
      const today = new Date().toISOString().split("T")[0]
      const { data: promoData, error: promoError } = await supabase
        .from("promotion_codes")
        .select("*")
        .eq("event_id", eventId)
        .eq("code", promotionCode.toUpperCase())
        .eq("is_active", true)
        .gte("valid_until", today)
        .lte("valid_from", today)
        .single()

      if (promoError || !promoData) {
        setError("Código de promoción inválido o expirado")
        setDiscountApplied(false)
        const selectedTier = tiers.find((t) => t.id === selectedTierId)
        setFinalPrice(selectedTier?.base_price || eventPrice)
        return
      }

      if (promoData.max_uses && promoData.current_uses >= promoData.max_uses) {
        setError("Este código de promoción ya alcanzó el límite de usos")
        setDiscountApplied(false)
        const selectedTier = tiers.find((t) => t.id === selectedTierId)
        setFinalPrice(selectedTier?.base_price || eventPrice)
        return
      }

      const selectedTier = tiers.find((t) => t.id === selectedTierId)
      let price = selectedTier?.base_price || eventPrice

      if (promoData.promotion_type === "protocol") {
        price = 0
      } else if (promoData.promotion_type === "percentage") {
        price = price - (price * promoData.discount_value) / 100
      } else if (promoData.promotion_type === "fixed") {
        price = Math.max(0, price - promoData.discount_value)
      } else if (promoData.promotion_type === "2x1") {
        price = price / 2
      }

      setFinalPrice(Math.max(0, price))
      setDiscountApplied(true)
      setError(null)
    } catch (error) {
      console.error("[v0] Error validating promotion:", error)
      setError("Error al validar el código de promoción")
    }
  }

  const handleTierSelection = async (tierId: string) => {
    setSelectedTierId(tierId)
    const selectedTier = tiers.find((t) => t.id === tierId)
    if (selectedTier) {
      setFinalPrice(selectedTier.base_price)
      if (promotionCode) {
        await validatePromotion()
      }
    }
    setStep("form")
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      let priceToUse = 0

      if (isFree) {
        priceToUse = 0
      } else if (isPwyw) {
        priceToUse = Number.parseFloat(customPrice) || 0
      } else {
        priceToUse = finalPrice
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const createdTicketIds: string[] = []

      for (let i = 0; i < quantity; i++) {
        const qrCode = `TICKET-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`

        const ticketData = {
          event_id: eventId,
          tier_id: selectedTierId,
          buyer_name: name,
          buyer_email: email,
          qr_code: qrCode,
          promotion_code: promotionCode || undefined,
          final_price: priceToUse,
          payment_method: (isFree || (isPwyw && priceToUse === 0) ? "free" : paymentMethod) as
            | "mercado_pago"
            | "external_link"
            | "transfer"
            | "free",
          marketing_consent: marketingConsent,
          buyer_id: currentUser?.id ?? null,
          // Solo se envía un único email consolidado por compra, no uno por entrada.
          sendEmail: i === quantity - 1,
          ticketQuantity: quantity,
        }

        console.log(`[v0] Creando ticket ${i + 1}/${quantity}...`, ticketData)

        const ticket = await createTicket(ticketData)
        createdTicketIds.push(ticket.id)

        console.log(`[v0] Ticket ${i + 1}/${quantity} creado exitosamente:`, ticket.id)
      }

      setTicketId(createdTicketIds[0]) // Guardamos el primer ID para referencia
      setTicketIds(createdTicketIds) // Guardamos todos los IDs de la compra (para el comprobante)

      if (isFree || (isPwyw && priceToUse === 0)) {
        setStep("success")
      } else if (paymentMethod === "transfer") {
        setCheckoutUrl(null)
        setStep("receipt")
      } else if (mercadoPagoLink) {
        setCheckoutUrl(null)
        setStep("payment")
      } else {
  const checkoutResponse = await fetch("/api/mercadopago/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketIds }) })
  const checkoutData = await checkoutResponse.json()
  if (!checkoutResponse.ok) throw new Error(checkoutData.error || "No se pudo iniciar el pago")
  setCheckoutUrl(checkoutData.initPoint)
  setStep("payment")
  }
    } catch (error: unknown) {
      console.error("[v0] Error al crear reserva:", error)
      const { toast } = await import("@/hooks/use-toast")
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Error al procesar la reserva. Por favor, intenta nuevamente.",
      })
      setError(error instanceof Error ? error.message : "Error al procesar la reserva")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReceiptUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    const idsToUpdate = ticketIds.length > 0 ? ticketIds : ticketId ? [ticketId] : []
    if (!receiptFile || idsToUpdate.length === 0) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", receiptFile)

      console.log("[v0] Subiendo comprobante...")

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      }).catch((err) => {
        handleNetworkError(err)
        throw err
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || "Error al subir el comprobante")
      }

      const { url } = await uploadResponse.json()
      console.log("[v0] Comprobante subido exitosamente:", url)

      // Un mismo comprobante corresponde a toda la compra: se aplica a todas las entradas.
      await Promise.all(idsToUpdate.map((id) => updateTicketReceipt(id, url, receiptNotes || undefined)))

      console.log("[v0] Tickets actualizados con comprobante:", idsToUpdate)
      setStep("success")
    } catch (error: unknown) {
      console.error("[v0] Error al subir comprobante:", error)
      if (!(error instanceof TypeError)) {
        setError(error instanceof Error ? error.message : "Error al subir comprobante")
      }
    } finally {
      setUploading(false)
    }
  }

  if (step === "tiers" && tiers.length > 0) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-3">Selecciona el tipo de entrada</h3>
          <div className="grid gap-3">
            {tiers.map((tier) => (
              <Button
                key={tier.id}
                variant={selectedTierId === tier.id ? "default" : "outline"}
                className="justify-between p-4 h-auto"
                onClick={() => handleTierSelection(tier.id)}
                disabled={tier.available_quantity === 0}
              >
                <div className="text-left">
                  <div className="font-medium">{tier.name}</div>
                  <div className="text-xs opacity-70">{tier.available_quantity} disponibles</div>
                </div>
                <div className="font-semibold">{formatCurrency(tier.base_price)}</div>
              </Button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === "form") {
    const effectiveMaxTickets = maxTicketsPerPerson ? Math.min(maxTicketsPerPerson, 10) : 10

    return (
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre Completo</Label>
          <Input
            id="name"
            type="text"
            placeholder="Juan Pérez"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <input
            id="marketing-consent"
            type="checkbox"
            checked={marketingConsent}
            onChange={(event) => setMarketingConsent(event.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <Label htmlFor="marketing-consent" className="text-sm font-normal leading-relaxed">
            Quiero guardar mis datos para comprar más rápido en futuros eventos y recibir novedades.
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">Cantidad de Entradas</Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            max={effectiveMaxTickets}
            required
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, Math.min(effectiveMaxTickets, Number.parseInt(e.target.value) || 1)))
            }
          />
          <p className="text-xs text-muted-foreground">
            {maxTicketsPerPerson
              ? `Máximo ${effectiveMaxTickets} entradas por persona para este evento`
              : "Máximo 10 entradas por compra"}
          </p>
        </div>

        {isPwyw && (
          <div className="space-y-2">
            <Label htmlFor="custom-price">¿Cuánto querés aportar? (opcional)</Label>
            <Input
              id="custom-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
            />
          </div>
        )}

        {!isFree && (
          <div className="space-y-2">
            <Label htmlFor="promo-code">Código de Promoción (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="promo-code"
                type="text"
                placeholder="Ingresa tu código"
                value={promotionCode}
                onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
              />
              <Button type="button" variant="outline" onClick={validatePromotion}>
                Aplicar
              </Button>
            </div>
          </div>
        )}

        {discountApplied && (
          <Alert className="bg-green-50 border-green-200">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ¡Código aplicado! Precio con descuento: {formatCurrency(finalPrice)}
            </AlertDescription>
          </Alert>
        )}

        {!isFree && (
          <div className="space-y-3">
            <Label>Elegí cómo pagar</Label>
            <div className="grid gap-2">
              {availablePaymentMethods.includes(mercadoPagoLink ? "external_link" : "mercado_pago") && <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input type="radio" name="payment-method" checked={paymentMethod === (mercadoPagoLink ? "external_link" : "mercado_pago")} onChange={() => setPaymentMethod(mercadoPagoLink ? "external_link" : "mercado_pago")} className="mt-1" />
                <span><span className="block font-medium">{mercadoPagoLink ? "Link de Mercado Pago" : "Mercado Pago"}</span><span className="block text-xs text-muted-foreground">Mercado Pago cobrará sus cargos adicionales. No necesitás adjuntar comprobante.</span></span>
              </label>}
              {availablePaymentMethods.includes("transfer") && paymentInstructions && <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"><input type="radio" name="payment-method" checked={paymentMethod === "transfer"} onChange={() => setPaymentMethod("transfer")} className="mt-1" /><span><span className="block font-medium">Transferencia bancaria</span><span className="block text-xs text-muted-foreground">No tiene cargos adicionales. Vas a tener que adjuntar el comprobante.</span></span></label>}
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          {tiers.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Entrada:</span>
              <span className="font-medium">{tiers.find((t) => t.id === selectedTierId)?.name || "General"}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Cantidad:</span>
            <span className="font-medium">
              {quantity} {quantity === 1 ? "entrada" : "entradas"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Precio unitario:</span>
            <span className="font-medium">
              {isFree && "Gratis"}
              {isPwyw && !isFree && (customPrice ? formatCurrency(Number.parseFloat(customPrice)) : "A voluntad")}
              {!isFree && !isPwyw && formatCurrency(finalPrice)}
            </span>
          </div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total a pagar:</span>
            <span className="text-xl font-bold text-primary">
              {isFree && "Gratis"}
              {isPwyw &&
                !isFree &&
                (customPrice ? formatCurrency(Number.parseFloat(customPrice) * quantity) : "A voluntad")}
              {!isFree && !isPwyw && formatCurrency(finalPrice * quantity)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {tiers.length > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep("tiers")} className="flex-1">
              Cambiar Entrada
            </Button>
          )}
          <Button type="submit" className={tiers.length > 0 ? "flex-1" : "w-full"} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </div>
      </form>
    )
  }

  if (step === "payment") {
    return (
      <div className="space-y-6">
        {paymentNotice && <Alert variant={paymentNotice.includes("no se completó") ? "destructive" : "default"}><AlertDescription>{paymentNotice}</AlertDescription></Alert>}
        <Alert>
          <AlertDescription className="text-sm leading-relaxed">
            {mercadoPagoLink || checkoutUrl
              ? "Usá el botón de Mercado Pago para completar el pago. Una vez aprobado, tu entrada se confirmará automáticamente."
              : paymentInstructions
                ? paymentInstructions
                : "Realizá la transferencia bancaria según las instrucciones y luego cargá el comprobante. Un organizador revisará el pago y confirmará tu entrada manualmente."}
          </AlertDescription>
        </Alert>

        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Evento:</span>
            <span className="font-medium">{eventTitle}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Comprador:</span>
            <span className="font-medium">{name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Cantidad:</span>
            <span className="font-medium">
              {quantity} {quantity === 1 ? "entrada" : "entradas"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total a pagar:</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(finalPrice * quantity)}</span>
          </div>
        </div>

        {paymentNotice?.includes("no se completó") && <Button type="button" variant="outline" className="w-full" onClick={() => { setPaymentNotice(null); setStep("form") }}>Volver y revisar datos</Button>}
  {mercadoPagoLink ? (
  <Button asChild className="w-full">
  <a href={mercadoPagoLink} target="_blank" rel="noopener noreferrer">Pagar con Mercado Pago</a>
  </Button>
  ) : checkoutUrl ? (
          <Button asChild className="w-full">
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">Pagar con Mercado Pago</a>
          </Button>
        ) : null}

        {mercadoPagoLink ? (
          <p className="text-center text-xs text-muted-foreground">El pago se realizará mediante el link cargado por el productor. La confirmación queda pendiente de revisión manual.</p>
        ) : checkoutUrl ? (
          <p className="text-center text-xs text-muted-foreground">El pago se generó con el importe de esta compra.</p>
        ) : (
          <Alert variant="destructive"><AlertDescription>El productor todavía no configuró Mercado Pago.</AlertDescription></Alert>
        )}
      </div>
    )
  }

  if (step === "receipt") {
    return (
      <form onSubmit={handleReceiptUpload} className="space-y-4">
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Cantidad:</span>
            <span className="font-medium">
              {quantity} {quantity === 1 ? "entrada" : "entradas"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total a pagar:</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(finalPrice * quantity)}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="receipt">Comprobante de Pago</Label>
          <div className="flex items-center gap-2">
            <Input
              id="receipt"
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="flex-1"
            />
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Formatos aceptados: JPG, PNG, PDF (máx. 5MB)</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            placeholder="Número de transferencia, fecha, etc."
            value={receiptNotes}
            onChange={(e) => setReceiptNotes(e.target.value)}
            rows={3}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setStep("form")} className="flex-1">
            Volver
          </Button>
          <Button type="submit" disabled={uploading || !receiptFile} className="flex-1">
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              "Enviar Comprobante"
            )}
          </Button>
        </div>
      </form>
    )
  }

  if (step === "success") {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">
          {isFree ? "¡Entradas Confirmadas!" : "Compra Pendiente de Confirmación"}
        </h3>
        {paymentNotice && <Alert><AlertDescription>{paymentNotice}</AlertDescription></Alert>}
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isFree
            ? `Has reservado ${quantity} ${quantity === 1 ? "entrada" : "entradas"} para ${eventTitle}. Recibirás un email con ${quantity === 1 ? "tu código QR" : "tus códigos QR"}.`
            : `Hemos recibido tu comprobante de pago por ${quantity} ${quantity === 1 ? "entrada" : "entradas"}. El organizador lo verificará y confirmará tus entradas. Recibirás un email con ${quantity === 1 ? "tu código QR" : "tus códigos QR"} cuando ${quantity === 1 ? "esté confirmada" : "estén confirmadas"}.`}
        </p>
        <p className="text-sm text-muted-foreground">
          Te enviamos los detalles a: <strong>{email}</strong>
        </p>
      </div>
    )
  }

  return null
}
