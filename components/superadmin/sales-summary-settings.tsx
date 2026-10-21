"use client"

import { useState, useTransition } from "react"
import { Mail, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { saveSalesSummarySettings, sendCurrentSalesSummary } from "@/app/actions/sales-summary-settings"
import type { SalesSummaryFrequency } from "@/lib/sales-summary"

export function SalesSummarySettings({ initialFrequency }: { initialFrequency: SalesSummaryFrequency }) {
  const [frequency, setFrequency] = useState(initialFrequency)
  const [isPending, startTransition] = useTransition()
  const [isSending, setIsSending] = useState(false)

  const save = () => startTransition(async () => {
    try {
      await saveSalesSummarySettings(frequency)
      toast.success("Configuración guardada")
    } catch {
      toast.error("No se pudo guardar la configuración")
    }
  })

  const sendNow = () => {
    setIsSending(true)
    startTransition(async () => {
      try {
        const result = await sendCurrentSalesSummary()
        toast.success(result.message)
      } catch {
        toast.error("No se pudo enviar el informe")
      } finally {
        setIsSending(false)
      }
    })
  }

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
      <div className="grid gap-2">
        <Label htmlFor="sales-summary-frequency">Frecuencia automática</Label>
        <select id="sales-summary-frequency" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={frequency} onChange={(event) => setFrequency(event.target.value as SalesSummaryFrequency)}>
          <option value="monthly">Mensual (predeterminado)</option>
          <option value="weekly">Semanal</option>
          <option value="off">No enviar automáticamente</option>
        </select>
        <p className="text-xs text-muted-foreground">El informe incluye ventas online, ventas en puerta y el estado de cada evento.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={save} disabled={isPending || isSending}>
          <Save data-icon="inline-start" /> Guardar frecuencia
        </Button>
        <Button type="button" onClick={sendNow} disabled={isPending || isSending}>
          <Mail data-icon="inline-start" /> {isSending ? "Enviando…" : "Enviar informe ahora"}
        </Button>
      </div>
    </div>
  )
}
