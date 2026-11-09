"use client"

import { useMemo, useState } from "react"
import { Download, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AudienceAnticipationMetric, AudienceReportRow } from "@/app/admin/audience/page"

function csvCell(value: string | number | boolean) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(value)) : "—"
}

function formatDays(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)
}

function MetricTable({ title, metrics, empty }: { title: string; metrics: AudienceAnticipationMetric[]; empty: string }) {
  return (
    <div>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-3">{title === "Por evento" ? "Evento" : "Espacio"}</th><th className="p-3 text-right">Entradas</th><th className="p-3 text-right">Promedio</th><th className="p-3 text-right">Mediana</th></tr></thead>
          <tbody>
            {metrics.map((metric) => <tr key={metric.label} className="border-t"><td className="p-3 font-medium">{metric.label}</td><td className="p-3 text-right">{metric.tickets}</td><td className="p-3 text-right">{formatDays(metric.averageDays)} días</td><td className="p-3 text-right">{formatDays(metric.medianDays)} días</td></tr>)}
            {metrics.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AudienceReport({ rows, eventMetrics, venueMetrics }: { rows: AudienceReportRow[]; eventMetrics: AudienceAnticipationMetric[]; venueMetrics: AudienceAnticipationMetric[] }) {
  const [onlyConsent, setOnlyConsent] = useState(false)
  const visibleRows = useMemo(
    () => onlyConsent ? rows.filter((row) => row.marketingConsent) : rows,
    [onlyConsent, rows],
  )

  const downloadCsv = () => {
    const header = ["Email", "Nombre", "Teléfono", "Acepta marketing", "Entradas", "Última compra", "Eventos", "Gustos / etiquetas"]
    const body = visibleRows.map((row) => [
      row.email,
      row.name,
      row.phone,
      row.marketingConsent ? "Sí" : "No",
      row.ticketCount,
      row.lastPurchase ?? "",
      row.events.join(" | "),
      row.tags.join(" | "),
    ])
    const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "audiencia-tekateka.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadAnticipationCsv = () => {
    const header = ["Nivel", "Evento / espacio", "Entradas", "Promedio de anticipación (días)", "Mediana de anticipación (días)"]
    const body = [
      ...eventMetrics.map((metric) => ["Evento", metric.label, metric.tickets, metric.averageDays, metric.medianDays]),
      ...venueMetrics.map((metric) => ["Espacio", metric.label, metric.tickets, metric.averageDays, metric.medianDays]),
    ]
    const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "anticipacion-de-compra-tekateka.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Audiencia histórica</CardTitle>
                <CardDescription className="mt-2">
                  Un contacto por email, consolidado a partir de compras confirmadas y entradas usadas.
                </CardDescription>
              </div>
              <Button onClick={downloadCsv} className="gap-2"><Download className="h-4 w-4" />Descargar CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyConsent} onChange={(event) => setOnlyConsent(event.target.checked)} className="h-4 w-4" />
              Mostrar solo personas que aceptaron recibir comunicaciones
            </label>
            <p className="mb-4 text-sm text-muted-foreground">{visibleRows.length} contactos · El teléfono aparece cuando fue informado.</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left"><tr>
                  <th className="p-3">Nombre</th><th className="p-3">Email</th><th className="p-3">Teléfono</th>
                  <th className="p-3">Entradas</th><th className="p-3">Última compra</th><th className="p-3">Eventos</th><th className="p-3">Gustos / etiquetas</th><th className="p-3">Marketing</th>
                </tr></thead>
                <tbody>
                  {visibleRows.map((row) => <tr key={row.email} className="border-t align-top">
                    <td className="p-3 font-medium">{row.name || "—"}</td><td className="p-3">{row.email}</td><td className="p-3">{row.phone || "—"}</td>
                    <td className="p-3">{row.ticketCount}</td><td className="p-3">{formatDate(row.lastPurchase)}</td>
                    <td className="max-w-xs p-3">{row.events.join(", ") || "—"}</td><td className="max-w-xs p-3">{row.tags.join(", ") || "—"}</td>
                    <td className="p-3">{row.marketingConsent ? "Sí" : "No"}</td>
                  </tr>)}
                  {visibleRows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No hay compradores para mostrar.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Anticipación de compra</CardTitle>
                <CardDescription>Cuántos días antes del evento se compró cada entrada. El promedio sirve para planificar; la mediana evita que compras muy anticipadas distorsionen el dato.</CardDescription>
              </div>
              <Button variant="outline" onClick={downloadAnticipationCsv} className="gap-2"><Download className="h-4 w-4" />Exportar promedios</Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <MetricTable title="Por evento" metrics={eventMetrics} empty="No hay datos por evento." />
            <MetricTable title="Por espacio" metrics={venueMetrics} empty="No hay espacios informados." />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
