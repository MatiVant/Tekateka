"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Upload, X, ImageIcon, Plus, Trash2 } from "lucide-react"
import { handleNetworkError } from "@/lib/network-error-handler"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import { saveEvent } from "@/app/actions/save-event"

interface EventFormProps {
  userId: string
  event?: {
    id: string
    title: string
    description: string | null
    event_date: string
    venue: string
    price: number
    total_tickets: number
    image_url: string | null
    status: string
    is_pay_what_you_want: boolean
    max_tickets_per_person?: number
    mercado_pago_link?: string | null
  }
}

export function EventForm({ userId, event }: EventFormProps) {
  const [title, setTitle] = useState(event?.title || "")
  const [description, setDescription] = useState(event?.description || "")

  const eventDateTime = event?.event_date ? new Date(event.event_date) : null
  const [eventDate, setEventDate] = useState(eventDateTime ? eventDateTime.toISOString().slice(0, 10) : "")
  const [eventTime, setEventTime] = useState(eventDateTime ? eventDateTime.toISOString().slice(11, 16) : "")

  const [venue, setVenue] = useState(event?.venue || "")
  const [locationUrl, setLocationUrl] = useState((event as { location_url?: string | null } | undefined)?.location_url || "")
  const [price, setPrice] = useState(event?.price.toString() || "")
  const [totalTickets, setTotalTickets] = useState(event?.total_tickets.toString() || "")
  const [imageUrl, setImageUrl] = useState(event?.image_url || "")
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(event?.image_url || null)
  const [eventType, setEventType] = useState<"paid" | "free" | "pwyw">(
    event?.price === 0 ? "free" : event?.is_pay_what_you_want ? "pwyw" : "paid",
  )
  const [maxTicketsPerPerson, setMaxTicketsPerPerson] = useState(event?.max_tickets_per_person?.toString() || "")
  const [mercadoPagoLink, setMercadoPagoLink] = useState(event?.mercado_pago_link || "")
  const [ticketTiers, setTicketTiers] = useState<
    Array<{
      name: string
      description: string
      base_price: string
      quantity: string
    }>
  >([])
  const [showTierForm, setShowTierForm] = useState(false)
  const [tierFormData, setTierFormData] = useState({
    name: "",
    description: "",
    base_price: "",
    quantity: "",
  })
  const router = useRouter()
  const { toast } = useToast()

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // La Home recorta las imágenes en formato horizontal 16:9.
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Usá una imagen JPG, PNG o WebP en formato horizontal (16:9)",
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La imagen no debe superar los 5MB",
      })
      return
    }

    if (file.size > 500 * 1024) {
      toast({ variant: "destructive", title: "Imagen demasiado pesada", description: "Reducila a menos de 500 KB para que se vea rápido en la Home." })
      return
    }

    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error("No se pudo leer la imagen"))
      image.src = URL.createObjectURL(file)
    })
    const ratio = dimensions.width / dimensions.height
    if (dimensions.width < 1200 || Math.abs(ratio - 16 / 9) > 0.08) {
      toast({ variant: "destructive", title: "Formato recomendado: 16:9", description: "Subí una imagen horizontal de al menos 1200 × 675 px para evitar recortes." })
      return
    }

    setIsUploading(true)

    try {
      const uploadFormData = new FormData()
      uploadFormData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      }).catch((err) => {
        handleNetworkError(err)
        throw err
      })

      if (!response.ok) {
        throw new Error("Error al subir la imagen")
      }

      const { url } = await response.json()

      setImageUrl(url)
      setImagePreview(url)
    } catch (error) {
      console.error("Error uploading image:", error)
      if (!(error instanceof TypeError)) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al subir la imagen. Por favor intenta de nuevo.",
        })
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setImageUrl("")
    setImagePreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const combinedDateTime = new Date(`${eventDate}T${eventTime}:00`).toISOString()

      let basePrice = 0
      if (eventType === "free") {
        basePrice = 0
      } else if (ticketTiers.length === 0) {
        // Si no hay tipos de entrada, usar el precio base del evento
        basePrice = Number.parseFloat(price)
      } else {
        // Si hay tipos de entrada, el precio base del evento no importa
        basePrice = Math.min(...ticketTiers.map((tier) => Number.parseFloat(tier.base_price)))
      }

      const eventData = {
        title,
        description: description || null,
        event_date: combinedDateTime,
        venue,
        location_url: locationUrl || null,
        price: basePrice,
        is_pay_what_you_want: eventType === "pwyw",
        total_tickets: Number.parseInt(totalTickets),
        available_tickets: event ? event.total_tickets : Number.parseInt(totalTickets),
        image_url: imageUrl || null,
        status: "active",
        organizer_id: userId,
        max_tickets_per_person: maxTicketsPerPerson ? Number.parseInt(maxTicketsPerPerson) : null,
        mercado_pago_link: mercadoPagoLink || null,
      }

      const tiersToSave = ticketTiers.map((tier, index) => ({
        name: tier.name,
        description: tier.description || null,
        base_price: Number.parseFloat(tier.base_price),
        quantity: Number.parseInt(tier.quantity),
        available_quantity: Number.parseInt(tier.quantity),
        tier_order: index,
      }))

      await saveEvent(eventData, tiersToSave, event?.id)

      toast({
        title: "Éxito",
        description: event ? "Evento actualizado correctamente" : "Evento creado correctamente",
      })

      router.push("/admin")
      router.refresh()
    } catch (error: unknown) {
      console.error("[v0] Error al guardar evento:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al guardar el evento",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTier = () => {
    if (!tierFormData.name || !tierFormData.base_price || !tierFormData.quantity) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor completa todos los campos requeridos del tipo de entrada",
      })
      return
    }

    setTicketTiers([...ticketTiers, { ...tierFormData }])
    setTierFormData({ name: "", description: "", base_price: "", quantity: "" })
    setShowTierForm(false)
  }

  const handleRemoveTier = (index: number) => {
    setTicketTiers(ticketTiers.filter((_, i) => i !== index))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Título del Evento *</Label>
        <Input
          id="title"
          type="text"
          placeholder="Concierto de Rock en Vivo"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          placeholder="Describe los detalles del evento..."
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="eventDate">Fecha del evento *</Label>
          <Input id="eventDate" type="date" required min={new Date().toISOString().slice(0, 10)} value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-11 cursor-pointer" />
          <p className="text-xs text-muted-foreground">Elegí la fecha desde el calendario.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventTime">Hora de inicio *</Label>
          <Input id="eventTime" type="time" required value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="h-11 cursor-pointer" />
          <p className="text-xs text-muted-foreground">Elegí la hora desde el reloj.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="venue">Lugar *</Label>
          <Input id="venue" type="text" placeholder="Teatro Nacional" required value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="locationUrl">Ubicación en Google Maps (opcional)</Label>
          <Input id="locationUrl" type="url" placeholder="https://maps.google.com/..." value={locationUrl} onChange={(e) => setLocationUrl(e.target.value)} />
          <p className="text-xs text-muted-foreground">Pegá el enlace para que los asistentes puedan abrir la ubicación.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Tipo de Evento *</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={eventType === "paid" ? "default" : "outline"}
              onClick={() => setEventType("paid")}
              className="w-full"
            >
              Pago
            </Button>
            <Button
              type="button"
              variant={eventType === "free" ? "default" : "outline"}
              onClick={() => {
                setEventType("free")
                setPrice("0")
              }}
              className="w-full"
            >
              Gratis
            </Button>
            <Button
              type="button"
              variant={eventType === "pwyw" ? "default" : "outline"}
              onClick={() => setEventType("pwyw")}
              className="w-full"
            >
              A la gorra
            </Button>
          </div>
        </div>

        {eventType !== "free" && ticketTiers.length === 0 && (
          <div className="space-y-2">
            <Label htmlFor="price">{eventType === "pwyw" ? "Precio sugerido ($)" : "Precio ($)"} *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="25.00"
              required={eventType === "paid"}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Si agregas tipos de entrada abajo, este precio no se usará</p>
          </div>
        )}

        {ticketTiers.length > 0 && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">Precio Base del Evento</Label>
            <p className="text-sm">
              Los tipos de entrada definen sus propios precios. El precio más bajo es:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(Math.min(...ticketTiers.map((tier) => Number.parseFloat(tier.base_price))))}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="totalTickets">Total de Entradas *</Label>
        <Input
          id="totalTickets"
          type="number"
          min="1"
          placeholder="500"
          required
          value={totalTickets}
          onChange={(e) => setTotalTickets(e.target.value)}
          disabled={!!event}
        />
        {event && (
          <p className="text-xs text-muted-foreground">
            No se puede modificar el total de entradas de un evento existente
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxTicketsPerPerson">Límite de Entradas por Persona (opcional)</Label>
        <Input
          id="maxTicketsPerPerson"
          type="number"
          min="1"
          placeholder="10"
          value={maxTicketsPerPerson}
          onChange={(e) => setMaxTicketsPerPerson(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Cantidad máxima de entradas que puede comprar una persona. Dejar vacío para sin límite.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mercadoPagoLink">Link de Pago - Mercado Pago (opcional)</Label>
        <Input
          id="mercadoPagoLink"
          type="url"
          placeholder="https://pay.mercadopago.com/..."
          value={mercadoPagoLink}
          onChange={(e) => setMercadoPagoLink(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Proporciona el link de pago de Mercado Pago para que los compradores paguen las entradas
        </p>
      </div>

      {!event && (
        <div className="space-y-4 border-t pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Tipos de Entrada (opcional)</h3>
              <p className="text-sm text-muted-foreground">
                {ticketTiers.length > 0
                  ? "Los tipos de entrada reemplazan el precio base del evento"
                  : "Configura diferentes tipos de entradas con distintos precios"}
              </p>
            </div>
            <Button type="button" onClick={() => setShowTierForm(!showTierForm)} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Tipo
            </Button>
          </div>

          {showTierForm && (
            <Card className="p-4 bg-muted/50">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tier-name">Nombre del Tipo *</Label>
                  <Input
                    id="tier-name"
                    placeholder="Early Bird, General, VIP, etc."
                    value={tierFormData.name}
                    onChange={(e) => setTierFormData({ ...tierFormData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tier-description">Descripción</Label>
                  <Input
                    id="tier-description"
                    placeholder="Descripción del tipo de entrada"
                    value={tierFormData.description}
                    onChange={(e) => setTierFormData({ ...tierFormData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tier-price">Precio ($) *</Label>
                    <Input
                      id="tier-price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="50.00"
                      value={tierFormData.base_price}
                      onChange={(e) => setTierFormData({ ...tierFormData, base_price: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tier-quantity">Cantidad *</Label>
                    <Input
                      id="tier-quantity"
                      type="number"
                      min="1"
                      placeholder="100"
                      value={tierFormData.quantity}
                      onChange={(e) => setTierFormData({ ...tierFormData, quantity: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" onClick={handleAddTier} size="sm">
                    Agregar
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowTierForm(false)} size="sm">
                    Cancelar
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {ticketTiers.length > 0 && (
            <div className="space-y-2">
              {ticketTiers.map((tier, index) => (
                <Card key={index} className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{tier.name}</h4>
                    {tier.description && <p className="text-sm text-muted-foreground">{tier.description}</p>}
                    <p className="text-sm">
                      {formatCurrency(Number.parseFloat(tier.base_price))} - {tier.quantity} disponibles
                    </p>
                  </div>
                  <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveTier(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Imagen del Evento</Label>
        <div className="mt-2">
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview || "/placeholder.svg"}
                alt="Preview"
                className="w-full h-64 object-cover rounded-lg border-2 border-border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <div className="mt-4">
                <Label
                  htmlFor="image-upload"
                  className="cursor-pointer text-primary hover:text-primary/80 inline-flex items-center"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar imagen
                </Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
              </div>
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Cómo preparar la imagen</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Horizontal, proporción 16:9.</li>
                  <li>Mínimo 1200 × 675 px.</li>
                  <li>JPG, PNG o WebP, hasta 500 KB.</li>
                  <li>La Home la mostrará recortada dentro de una tarjeta horizontal.</li>
                </ul>
              </div>
            </div>
          )}
          {isUploading && (
            <div className="flex items-center justify-center mt-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Subiendo imagen...
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading || isUploading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : event ? (
            "Actualizar Evento"
          ) : (
            "Crear Evento"
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
