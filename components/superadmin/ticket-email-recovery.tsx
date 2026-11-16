"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react"

export function TicketEmailRecovery() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ total: number; sent: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failures, setFailures] = useState<{ id: string; buyer_email: string; error_message: string | null; attempts: number; events?: { title?: string } | null }[]>([])

  const loadFailures = async () => {
    const response = await fetch("/api/superadmin/send-pending-ticket-emails")
    if (response.ok) setFailures((await response.json()).failures ?? [])
  }

  async function sendPending() {
    setLoading(true)
    setError(null)
    const response = await fetch("/api/superadmin/send-pending-ticket-emails", { method: "POST" })
    const data = await response.json().catch(() => null)
    if (!response.ok) setError(data?.error || "No se pudo ejecutar el envío")
    else { setResult(data); await loadFailures() }
    setLoading(false)
  }

  return <section className="rounded-2xl border bg-card p-5 shadow-sm">
    <div className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="font-semibold">Emails de entradas confirmadas</h2><p className="mt-1 text-sm text-muted-foreground">Envía o reintenta el email con los QR para compras confirmadas de eventos que todavía no sucedieron.</p></div></div>
    <Button type="button" className="mt-4" onClick={sendPending} disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</> : "Enviar pendientes y fallidos"}</Button>
    {result && <p className="mt-3 flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />Procesadas {result.total} compras: {result.sent} enviadas, {result.failed} fallidas.</p>}
    {error && <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>}
    {failures.length > 0 && <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3"><p className="text-sm font-semibold text-destructive">{failures.length} envíos fallidos</p><div className="mt-2 space-y-2 text-xs">{failures.slice(0, 10).map((failure) => <div key={failure.id}><p className="font-medium">{failure.events?.title || "Evento"} · {failure.buyer_email}</p><p className="text-muted-foreground">Intentos: {failure.attempts} · {failure.error_message || "Error sin detalle"}</p></div>)}</div></div>}
  </section>
}
