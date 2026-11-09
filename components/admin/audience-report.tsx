"use client"

import { useMemo, useState } from "react"
import { Download, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AudienceReportRow } from "@/app/admin/audience/page"

function csvCell(value: string | number | boolean) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(value)) : "—"
}

export function AudienceReport({ rows }: { rows: AudienceReportRow[] }) {
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
      </div>
    </main>
  )
}
