"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle2, Loader2, MessageCircle } from "lucide-react"

export function SupportForm({ eventId, eventTitle, ticketId }: { eventId?: string; eventTitle?: string; ticketId?: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [category, setCategory] = useState("Compra o pago")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("sending")
    const response = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buyerName: name, buyerEmail: email, category, message, eventId, ticketId }) })
    setStatus(response.ok ? "sent" : "error")
    if (response.ok) setMessage("")
  }

  return <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
    <div className="flex items-start gap-3">
      <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">¿Tuviste un problema?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Mandanos el detalle y te ayudamos con tu compra.</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setOpen((value) => !value); setStatus("idle") }}>{open ? "Cerrar formulario" : "Avisar un problema"}</Button>
        {open && <form onSubmit={submit} className="mt-4 space-y-3 border-t border-primary/15 pt-4">
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="support-name">Nombre</Label><Input id="support-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" /></div><div className="space-y-1"><Label htmlFor="support-email">Email</Label><Input id="support-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" /></div></div>
          <div className="space-y-1"><Label htmlFor="support-category">Motivo</Label><select id="support-category" value={category} onChange={(event) => setCategory(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option>Compra o pago</option><option>Entrada o QR</option><option>Problema técnico</option><option>Otro</option></select></div>
          <div className="space-y-1"><Label htmlFor="support-message">¿Qué pasó?</Label><Textarea id="support-message" required minLength={10} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Contanos qué no funcionó..." rows={4} /></div>
          {status === "sent" && <p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />Recibimos tu consulta. Te responderemos por email.</p>}
          {status === "error" && <p className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />No pudimos enviarla. Intentá nuevamente.</p>}
          <Button type="submit" disabled={status === "sending"}>{status === "sending" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : "Enviar consulta"}</Button>
        </form>}
      </div>
    </div>
    {eventTitle && <p className="mt-3 pl-8 text-xs text-muted-foreground">Evento: {eventTitle}</p>}
  </section>
}
