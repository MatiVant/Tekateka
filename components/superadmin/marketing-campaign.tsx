"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { sendMarketingCampaign } from "@/app/actions/marketing-campaign"

export function MarketingCampaign() {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setStatus(null)
    const result = await sendMarketingCampaign({ subject, body })
    setSending(false)
    if (result.error) {
      setStatus(result.error)
      return
    }
    setStatus(`Enviados: ${result.sent}. Omitidos o fallidos: ${result.skipped}.`)
    setSubject("")
    setBody("")
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Se enviará únicamente a compradores que aceptaron recibir promociones y no se desuscribieron. Cada email incluye un enlace de baja.</p>
      <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Asunto" maxLength={150} required />
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Mensaje de la campaña" rows={8} maxLength={10000} required />
      <Button type="submit" disabled={sending} className="gap-2"><Send className="h-4 w-4" />{sending ? "Enviando…" : "Enviar campaña"}</Button>
      {status && <p className="text-sm text-muted-foreground" role="status">{status}</p>}
    </form>
  )
}
