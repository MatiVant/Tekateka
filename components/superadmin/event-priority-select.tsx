"use client"

import { useState, useTransition } from "react"
import { updateEventPriority } from "@/app/actions/event-priority"
import { Label } from "@/components/ui/label"

export function EventPrioritySelect({ eventId, value = 0 }: { eventId: string; value?: number | null }) {
  const [priority, setPriority] = useState(String(value ?? 0))
  const [isPending, startTransition] = useTransition()
  return <div className="space-y-1.5"><Label htmlFor={`priority-${eventId}`} className="text-xs text-muted-foreground">Prioridad</Label><select id={`priority-${eventId}`} value={priority} disabled={isPending} onChange={(event) => { const next = event.target.value; setPriority(next); startTransition(async () => { try { await updateEventPriority(eventId, Number(next)) } catch { setPriority(priority) } }) }} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="0">Normal</option><option value="1">Destacado</option><option value="2">Prioridad máxima</option></select></div>
}
