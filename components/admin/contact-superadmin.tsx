"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { sendOrganizerMessage } from "@/app/actions/organizer-messages"
import { Send } from "lucide-react"

export function ContactSuperadmin() {
  const { toast } = useToast()
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal")
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)
    const result = await sendOrganizerMessage({ subject, body, priority })
    setIsSending(false)

    if (result.error) {
      toast({ variant: "destructive", title: "Error", description: result.error })
      return
    }
    toast({ title: "Mensaje enviado", description: "El equipo fue notificado y te contactará pronto." })
    setSubject("")
    setBody("")
    setPriority("normal")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contactar al equipo</CardTitle>
        <CardDescription>Enviá un mensaje al administrador si necesitás ayuda o querés reportar algo.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="subject">Asunto *</Label>
              <Input
                id="subject"
                required
                maxLength={150}
                placeholder="¿Sobre qué necesitás ayuda?"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "normal" | "high")}>
                <SelectTrigger id="priority" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Mensaje *</Label>
            <Textarea
              id="body"
              required
              maxLength={4000}
              rows={5}
              placeholder="Contanos en detalle qué necesitás..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={isSending}>
            <Send className="mr-2 h-4 w-4" />
            {isSending ? "Enviando..." : "Enviar mensaje"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
