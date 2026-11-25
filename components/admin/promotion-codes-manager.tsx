"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/format"

type PromotionType = "percentage" | "fixed" | "2x1" | "protocol" | "fixed_price"

interface PromotionCode {
  id: string
  code: string
  promotion_type: PromotionType
  discount_value: number
  description: string | null
  category: string | null
  max_uses: number | null
  current_uses: number
  valid_from: string
  valid_until: string
  is_active: boolean
}

interface PromotionCodesManagerProps {
  eventId: string
}

export function PromotionCodesManager({ eventId }: PromotionCodesManagerProps) {
  const [codes, setCodes] = useState<PromotionCode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    code: "",
    promotion_type: "percentage" as PromotionType,
    discount_value: "",
    description: "",
    category: "",
    max_uses: "",
    valid_from: "",
    valid_until: "",
  })
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function fetchCodes() {
    try {
      const { data, error: fetchError } = await supabase
        .from("promotion_codes")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })

      if (fetchError) throw fetchError
      setCodes(data || [])
    } catch (error) {
      console.error("[v0] Error fetching codes:", error)
      setError("Error al cargar códigos de promoción")
    }
  }

  useEffect(() => {
    window.setTimeout(() => { void fetchCodes() }, 0)
  }, [eventId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (formData.promotion_type === "fixed_price") {
        const price = Number.parseFloat(formData.discount_value)
        if (!Number.isFinite(price) || price <= 0) {
          setError("Ingresá el precio de la entrada con este código (mayor a $0). Para entradas gratis usá el tipo Protocolo.")
          return
        }
      }

      const discountValue =
        formData.promotion_type === "protocol"
          ? 100
          : formData.promotion_type === "2x1"
            ? 50
            : Number.parseFloat(formData.discount_value)

      const { error: insertError } = await supabase.from("promotion_codes").insert({
        event_id: eventId,
        code: formData.code.toUpperCase(),
        promotion_type: formData.promotion_type,
        discount_value: discountValue,
        description: formData.description || null,
        category: formData.category || null,
        max_uses: formData.max_uses ? Number.parseInt(formData.max_uses) : null,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until,
        is_active: true,
      })

      if (insertError) throw insertError

      setFormData({
        code: "",
        promotion_type: "percentage",
        discount_value: "",
        description: "",
        category: "",
        max_uses: "",
        valid_from: "",
        valid_until: "",
      })
      setShowForm(false)
      fetchCodes()
    } catch (error) {
      console.error("[v0] Error creating code:", error)
      const dbError = error as { code?: string; message?: string } | null
      if (formData.promotion_type === "fixed_price" && (dbError?.code === "23514" || dbError?.message?.includes("promotion_type_check"))) {
        setError("Los códigos de precio fijo todavía no están activados en la base de datos. Avisale al equipo de Tekateka.")
      } else if (dbError?.code === "23505") {
        setError("Ya existe un código con ese nombre en este evento")
      } else {
        setError(error instanceof Error ? error.message : "Error al crear código")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (codeId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este código?")) return

    try {
      const { error: deleteError } = await supabase.from("promotion_codes").delete().eq("id", codeId)

      if (deleteError) throw deleteError
      fetchCodes()
    } catch (error) {
      console.error("[v0] Error deleting code:", error)
      setError("Error al eliminar código")
    }
  }

  const getDiscountText = (code: PromotionCode) => {
    switch (code.promotion_type) {
      case "percentage":
        return `${code.discount_value}% de descuento`
      case "fixed":
        return `${formatCurrency(code.discount_value)} de descuento`
      case "fixed_price":
        return `Precio fijo: ${formatCurrency(code.discount_value)} por entrada`
      case "2x1":
        return "Promoción 2x1 (Paga 1, Lleva 2)"
      case "protocol":
        return "Entrada Protocolo (Gratis)"
      default:
        return ""
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Códigos de promoción</h3>
          <p className="text-sm text-muted-foreground">Aplicá descuentos sin modificar los tipos de entrada.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="w-fit">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Código
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl border-dashed bg-muted/20 p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                placeholder="VERANO2024"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="promo-type">Tipo de Promoción *</Label>
              <select
                id="promo-type"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                value={formData.promotion_type}
                onChange={(e) => setFormData({ ...formData, promotion_type: e.target.value as PromotionType })}
              >
                <option value="percentage">Descuento: porcentaje (%)</option>
                <option value="fixed">Descuento: monto fijo ($ menos)</option>
                <option value="fixed_price">Precio fijo ($ por entrada)</option>
                <option value="2x1">2x1 (Paga 1, Lleva 2)</option>
                <option value="protocol">Protocolo (Entrada Gratis)</option>
              </select>
            </div>

            {formData.promotion_type !== "2x1" && formData.promotion_type !== "protocol" && (
              <div className="space-y-2">
                <Label htmlFor="discount-value">
                  {formData.promotion_type === "percentage"
                    ? "Porcentaje (%)"
                    : formData.promotion_type === "fixed_price"
                      ? "Precio de la entrada con este código ($)"
                      : "Descuento ($)"}
                </Label>
                <Input
                  id="discount-value"
                  type="number"
                  step={formData.promotion_type === "percentage" ? "1" : "0.01"}
                  min="0"
                  placeholder={formData.promotion_type === "percentage" ? "20" : formData.promotion_type === "fixed_price" ? "5000" : "5.00"}
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  required
                />
                {formData.promotion_type === "fixed_price" && (
                  <p className="text-xs text-muted-foreground">
                    Cada entrada comprada con este código cuesta exactamente este valor, sin importar el precio normal del tipo de entrada
                    (incluso si el código sale más caro que la entrada). Se puede comprar 1 entrada por vez.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="category">Categoría (ej: Periodistas, Estudiantes)</Label>
              <Input
                id="category"
                placeholder="Periodistas"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                placeholder="Descuento para periodistas acreditados"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid-from">Válido Desde *</Label>
                <Input
                  id="valid-from"
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valid-until">Válido Hasta *</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-uses">Máximo de Usos (dejar vacío para ilimitado)</Label>
              <Input
                id="max-uses"
                type="number"
                min="1"
                placeholder="100"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="w-fit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Código"
                )}
              </Button>
              <Button type="button" variant="outline" className="w-fit" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {codes.map((code) => (
          <Card
            key={code.id}
            className={`flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between ${!code.is_active ? "opacity-50" : ""}`}
          >
            <div className="min-w-0">
              <h4 className="flex flex-wrap items-center gap-2 font-semibold">
                {code.code}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {code.promotion_type === "fixed_price" ? "Precio fijo" : code.promotion_type === "protocol" ? "Gratis" : code.promotion_type === "2x1" ? "2x1" : "Descuento"}
                </span>
              </h4>
              <p className="text-sm text-muted-foreground">{getDiscountText(code)}</p>
              {code.category && <p className="text-xs text-slate-500">Categoría: {code.category}</p>}
              <p className="text-xs text-slate-500">
                Usos: {code.current_uses}
                {code.max_uses ? `/${code.max_uses}` : ""} - Válido hasta {code.valid_until}
              </p>
            </div>
            <Button variant="destructive" size="icon-sm" className="self-end sm:self-center" onClick={() => handleDelete(code.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
