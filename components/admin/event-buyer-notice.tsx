"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Mail, Loader2, Send, Eye, X } from "lucide-react"

const initialRecipients = "mtrovant@gmail.com\nmativantmusica@gmail.com"
const initialSubject = "Fe de erratas: horario de Yendo con la Taba al Living"
const initialMessage = `Hola,

Te escribimos para informarte una corrección importante sobre el evento Yendo con la Taba al Living | Charly Carozzo + artistas invitados.

Por un error, algunas entradas mostraban un horario incorrecto.
El horario correcto del evento es:

Viernes 27 de noviembre de 2026 a las 21:00 hs.

Tu entrada y código QR siguen siendo válidos. No es necesario realizar ninguna acción adicional.

Disculpá la confusión.

Saludos,
Equipo TekaTeka`

export function EventBuyerNotice({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [open, setOpen] = useState(false)
  const [recipients, setRecipients] = useState(initialRecipients)
  const [subject, setSubject] = useState(initialSubject)
  const [message, setMessage] = useState(initialMessage)
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function sendNotice() {
    const recipientList = recipients.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean)
    if (!recipientList.length || !subject.trim() || !message.trim()) {
      setError("Completá destinatarios, asunto y mensaje")
      return
    }
    if (!window.confirm(`¿Enviar este aviso a ${recipientList.length} destinatario(s)?`)) return
    setLoading(true)
    setError(null)
    setResult(null)
    const response = await fetch(`/api/admin/events/${eventId}/buyer-notice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipients: recipientList, subject, message }) })
    const data = await response.json().catch(() => null)
    if (!response.ok) setError(data?.error || "No se pudo enviar el aviso")
    else setResult(`Aviso enviado a ${data.sent} destinatario(s).`)
    setLoading(false)
  }

  if (!open) return <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto" onClick={() => setOpen(true)}><Mail className="h-4 w-4" />Enviar aviso a compradores</Button>

  return <section className="rounded-xl border border-primary/20 bg-card p-5 shadow-sm lg:col-span-2">
    <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Aviso a compradores</h2><p className="mt-1 text-sm text-muted-foreground">Evento: {eventTitle}. No incluye QR ni modifica las entradas.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Cerrar"><X className="h-4 w-4" /></Button></div>
    <div className="mt-4 grid gap-4">
      <label className="grid gap-1.5 text-sm font-medium">Destinatarios <Textarea value={recipients} onChange={(event) => setRecipients(event.target.value)} rows={3} placeholder="Un email por línea" /></label>
      <label className="grid gap-1.5 text-sm font-medium">Asunto <Input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium">Mensaje <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={12} /></label>
    </div>
    <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setPreview((value) => !value)}><Eye className="mr-2 h-4 w-4" />{preview ? "Ocultar vista previa" : "Vista previa"}</Button><Button type="button" onClick={sendNotice} disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : <><Send className="mr-2 h-4 w-4" />Enviar aviso</>}</Button></div>
    {preview && <div className="mt-4 rounded-lg border bg-muted/30 p-4"><p className="text-sm font-semibold">{subject}</p><p className="mt-3 whitespace-pre-wrap text-sm">{message}</p></div>}
    {result && <p className="mt-3 text-sm text-emerald-700">{result}</p>}
    {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
  </section>
}
