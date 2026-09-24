"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface EventInsight {
  id: string
  title: string
  tags: string[]
  buyers: number
  related: string[]
}

export function AudienceInsights({ events }: { events: EventInsight[] }) {
  if (!events.length) return null

  return (
    <section className="mb-12">
      <Card>
        <CardHeader>
          <CardTitle>Intereses y eventos relacionados</CardTitle>
          <p className="text-sm text-muted-foreground">Una vista simple para detectar públicos parecidos. Todavía no envía campañas.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {events.slice(0, 8).map((event) => (
            <div key={event.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.buyers} compradores · {event.tags.join(" · ") || "Sin etiquetas"}</p>
                </div>
              </div>
              {event.related.length > 0 && <p className="mt-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">También puede interesarles:</span> {event.related.join(", ")}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
