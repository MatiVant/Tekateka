"use client"

import { useState, useTransition } from "react"
import { Mail, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { saveSalesSummarySettings, sendCurrentSalesSummary } from "@/app/actions/sales-summary-settings"
import type { SalesSummaryFrequency, SalesSummaryPeriod } from "@/lib/sales-summary"

type Organizer = { id: string; full_name: string | null; email: string | null }

export function SalesSummarySettings({ initialFrequency, organizers }: { initialFrequency: SalesSummaryFrequency; organizers: Organizer[] }) {
  const [frequency, setFrequency] = useState(initialFrequency)
  const [organizerId, setOrganizerId] = useState("")
  const [period, setPeriod] = useState<SalesSummaryPeriod>("fortnight")
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
        const result = await sendCurrentSalesSummary(organizerId || undefined, period)
        toast.success(result.message)
      } catch {
        toast.error("No se pudo enviar el informe")
      } finally {
        setIsSending(false)
      }
    })
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2 md:max-w-md">
        <Label htmlFor="sales-summary-frequency">Frecuencia automática</Label>
        <select id="sales-summary-frequency" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={frequency} onChange={(event) => setFrequency(event.target.value as SalesSummaryFrequency)}>
          <option value="biweekly">Cada 15 días</option>
          <option value="monthly">Mensual</option>
          <option value="weekly">Semanal</option>
          <option value="off">No enviar automáticamente</option>
        </select>
        <p className="text-xs text-muted-foreground">Los informes automáticos contienen únicamente eventos del organizador destinatario.</p>
        <Button type="button" variant="outline" onClick={save} disabled={isPending || isSending} className="w-fit"><Save data-icon="inline-start" /> Guardar frecuencia</Button>
      </div>

      <div className="rounded-lg border bg-muted/20 p-4">
        <h3 className="font-semibold">Envío manual</h3>
        <p className="mt-1 text-sm text-muted-foreground">Enviá un informe a todos o a un organizador específico.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="grid gap-2"><Label htmlFor="sales-summary-organizer">Destinatario</Label><select id="sales-summary-organizer" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={organizerId} onChange={(event) => setOrganizerId(event.target.value)}><option value="">Todos los organizadores</option>{organizers.map((organizer) => <option key={organizer.id} value={organizer.id}>{organizer.full_name || organizer.email || "Sin nombre"}</option>)}</select></div>
          <div className="grid gap-2"><Label htmlFor="sales-summary-period">Período</Label><select id="sales-summary-period" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={period} onChange={(event) => setPeriod(event.target.value as SalesSummaryPeriod)}><option value="fortnight">Últimos 15 días</option><option value="week">Últimos 7 días</option><option value="now">Mes actual</option></select></div>
          <div className="flex items-end"><Button type="button" onClick={sendNow} disabled={isPending || isSending} className="w-full"><Mail data-icon="inline-start" /> {isSending ? "Enviando…" : "Enviar informe"}</Button></div>
        </div>
      </div>
    </div>
  )
}
