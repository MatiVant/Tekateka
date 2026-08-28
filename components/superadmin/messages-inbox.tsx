"use client"

import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { replyToOrganizerMessage, updateMessageStatus } from "@/app/actions/organizer-messages"
import { Mail, Phone, Check, MailOpen, Inbox, Send } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type Status = "unread" | "read" | "resolved"
type Priority = "low" | "normal" | "high"

export interface OrganizerMessage {
  id: string
  subject: string
  body: string
  priority: Priority
  status: Status
  created_at: string
  organizer_name: string | null
  organizer_email: string | null
  organizer_phone: string | null
}

const PRIORITY_STYLES: Record<Priority, string> = {
  high: "bg-rose-100 text-rose-800 border-rose-200",
  normal: "bg-secondary text-secondary-foreground",
  low: "bg-muted text-muted-foreground",
}
const PRIORITY_LABELS: Record<Priority, string> = { high: "Alta", normal: "Normal", low: "Baja" }

const STATUS_STYLES: Record<Status, string> = {
  unread: "bg-amber-100 text-amber-800 border-amber-200",
  read: "bg-sky-100 text-sky-800 border-sky-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
}
const STATUS_LABELS: Record<Status, string> = { unread: "No leído", read: "Leído", resolved: "Resuelto" }

const FILTERS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "unread", label: "No leídos" },
  { key: "read", label: "Leídos" },
  { key: "resolved", label: "Resueltos" },
]

export function MessagesInbox({ messages }: { messages: OrganizerMessage[] }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<Status | "all">("all")
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState("")

  const visible = filter === "all" ? messages : messages.filter((m) => m.status === filter)
  const unreadCount = messages.filter((m) => m.status === "unread").length

  const sendReply = (messageId: string) => {
    startTransition(async () => {
      const result = await replyToOrganizerMessage({ messageId, body: replyBody })
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error })
        return
      }
      setReplyBody("")
      setReplyFor(null)
      toast({ title: "Respuesta enviada", description: "Se guardó en el historial y se envió por email." })
    })
  }

  const changeStatus = (id: string, status: Status) => {
    startTransition(async () => {
      const result = await updateMessageStatus(id, status)
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Mensajes de organizadores
              {unreadCount > 0 && <Badge className="bg-primary text-primary-foreground">{unreadCount} nuevos</Badge>}
            </CardTitle>
            <CardDescription>Consultas y reportes enviados por los organizadores.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? "default" : "outline"}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No hay mensajes en esta bandeja.</p>
        ) : (
          <ul className="space-y-4">
            {visible.map((m) => (
              <li key={m.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{m.subject}</span>
                      <Badge variant="outline" className={PRIORITY_STYLES[m.priority]}>
                        {PRIORITY_LABELS[m.priority]}
                      </Badge>
                      <Badge variant="outline" className={STATUS_STYLES[m.status]}>
                        {STATUS_LABELS[m.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {m.organizer_name || "Organizador"} ·{" "}
                      {new Date(m.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                    </p>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{m.body}</p>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  {m.organizer_email && (
                    <a
                      href={`mailto:${m.organizer_email}?subject=${encodeURIComponent("Re: " + m.subject)}`}
                      className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {m.organizer_email}
                    </a>
                  )}
                  {m.organizer_phone && (
                    <a
                      href={`tel:${m.organizer_phone}`}
                      className="inline-flex items-center gap-1.5 text-foreground/80 underline-offset-4 hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {m.organizer_phone}
                    </a>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => setReplyFor(replyFor === m.id ? null : m.id)}>
                    <Send className="mr-2 h-4 w-4" />Responder
                  </Button>
                  {m.status !== "read" && (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => changeStatus(m.id, "read")}>
                      <MailOpen className="mr-2 h-4 w-4" />
                      Marcar leído
                    </Button>
                  )}
                  {m.status !== "resolved" && (
                    <Button size="sm" disabled={isPending} onClick={() => changeStatus(m.id, "resolved")}>
                      <Check className="mr-2 h-4 w-4" />
                      Marcar resuelto
                    </Button>
                  )}
                  {m.status === "resolved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => changeStatus(m.id, "unread")}
                    >
                      Reabrir
                    </Button>
                  )}
                </div>

                {replyFor === m.id && (
                  <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                    <Label htmlFor={`reply-${m.id}`}>Respuesta</Label>
                    <Textarea
                      id={`reply-${m.id}`}
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder="Escribí una respuesta para el organizador..."
                      rows={4}
                      disabled={isPending}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" disabled={isPending} onClick={() => { setReplyFor(null); setReplyBody("") }}>Cancelar</Button>
                      <Button type="button" disabled={isPending || !replyBody.trim()} onClick={() => sendReply(m.id)}>
                        <Send className="mr-2 h-4 w-4" />{isPending ? "Enviando..." : "Enviar respuesta"}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
