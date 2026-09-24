"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Mail, Users } from "lucide-react"

interface EventInsight {
  id: string
  title: string
  tags: string[]
  buyers: number
  related: string[]
}

export function AudienceInsights({ events }: { events: EventInsight[] }) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const tagStats = useMemo(() => {
    const stats = new Map<string, { events: number; buyers: number }>()
    for (const event of events) for (const tag of event.tags) {
      const current = stats.get(tag) || { events: 0, buyers: 0 }
      stats.set(tag, { events: current.events + 1, buyers: current.buyers + event.buyers })
    }
    return [...stats.entries()].sort((a, b) => b[1].buyers - a[1].buyers)
  }, [events])
  const filteredEvents = selectedTag ? events.filter((event) => event.tags.includes(selectedTag)) : events
  const totalBuyers = events.reduce((sum, event) => sum + event.buyers, 0)

  return (
    <section className="mb-12">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Afinidades y acciones</CardTitle><p className="mt-1 text-sm text-muted-foreground">Usá los estilos elegidos en los eventos para detectar públicos relacionados.</p></div>
            <Button type="button" variant="outline" size="sm" disabled title="Disponible cuando habilitemos campañas"><Mail className="mr-2 h-4 w-4" />Preparar campaña</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5">
          {!events.length ? <div className="rounded-xl border border-dashed p-6 text-center"><p className="font-medium">Todavía no hay afinidades para mostrar</p><p className="mt-1 text-sm text-muted-foreground">Agregá estilos a los eventos para empezar a comparar públicos.</p></div> : <>
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-primary/10 p-4"><Users className="h-4 w-4 text-primary" /><p className="mt-2 text-2xl font-bold">{totalBuyers}</p><p className="text-xs text-muted-foreground">Compradores en eventos etiquetados</p></div><div className="rounded-xl bg-muted p-4"><p className="text-2xl font-bold">{events.length}</p><p className="text-xs text-muted-foreground">Eventos con afinidades</p></div><div className="rounded-xl bg-muted p-4"><p className="text-2xl font-bold">{tagStats.length}</p><p className="text-xs text-muted-foreground">Estilos utilizados</p></div></div>
            <div><p className="mb-2 text-sm font-medium">Explorar por estilo</p><div className="flex flex-wrap gap-2">{tagStats.map(([tag, stats]) => <Button key={tag} type="button" size="sm" variant={selectedTag === tag ? "default" : "outline"} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}>{tag} <Badge variant="secondary" className="ml-2">{stats.events}</Badge></Button>)}</div></div>
            <div className="grid gap-3 md:grid-cols-2">{filteredEvents.slice(0, 8).map((event) => <div key={event.id} className="rounded-xl border p-4"><p className="font-medium">{event.title}</p><p className="mt-1 text-xs text-muted-foreground">{event.buyers} compradores · {event.tags.join(" · ")}</p>{event.related.length > 0 && <p className="mt-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">También puede interesarles:</span> {event.related.join(", ")}</p>}</div>)}</div>
          </>}
        </CardContent>
      </Card>
    </section>
  )
}
