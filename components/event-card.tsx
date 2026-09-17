"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Ticket, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/format"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface EventCardProps {
  event: {
    id: string
    title: string
    description: string | null
    event_date: string
    venue: string
    price: number
    available_tickets: number
    total_tickets: number
    image_url: string | null
    location_url?: string | null
    status: string
  }
  featured?: boolean
}

export function EventCard({ event, featured = false }: EventCardProps) {
  const eventDate = new Date(event.event_date)
  const [confirmedCount, setConfirmedCount] = useState(0)
  const realAvailableTickets = Math.max(0, event.total_tickets - confirmedCount)
  const isAvailable = event.status === "active" && realAvailableTickets > 0

  const [minPrice, setMinPrice] = useState<number | null>(null)

  useEffect(() => {
    const fetchMinPrice = async () => {
      try {
        const supabase = createClient()
        const { count } = await supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "confirmed")
        setConfirmedCount(count ?? 0)
        const { data: tiers } = await supabase
          .from("ticket_tiers")
          .select("base_price")
          .eq("event_id", event.id)
          .order("base_price", { ascending: true })
          .limit(1)

        if (tiers && tiers.length > 0) {
          setMinPrice(tiers[0].base_price)
        }
      } catch (error) {
        console.error("Error al obtener precio mínimo:", error)
      }
    }

    fetchMinPrice()
  }, [event.id])

  return (
    <Card
      className={`group overflow-hidden bg-card hover:border-primary/40 transition-all duration-500 event-card-glow ${featured ? "h-full" : ""}`}
    >
      <div className={`relative overflow-hidden bg-muted ${featured ? "aspect-[16/10]" : "aspect-video"}`}>
        <img
          src={
            event.image_url ||
            `/placeholder.svg?height=${featured ? 600 : 400}&width=${featured ? 800 : 600}&query=evento+${encodeURIComponent(event.title)}`
          }
          alt={event.title}
          className="object-cover w-full h-full group-hover:scale-103 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

        {!isAvailable && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <Badge variant="destructive" className="text-base px-4 py-2 font-semibold">
              {event.status === "sold_out" || realAvailableTickets === 0 ? "Agotado" : "No Disponible"}
            </Badge>
          </div>
        )}
        {isAvailable && realAvailableTickets <= Math.max(5, Math.ceil(event.total_tickets * 0.1)) && (
          <Badge className="absolute bottom-4 left-4 bg-primary text-primary-foreground">Últimos lugares</Badge>
        )}

        {isAvailable && (
          <div className="absolute top-4 right-4 backdrop-blur-sm bg-background/70 rounded-lg px-3 py-2 border border-primary/30">
            <div className="text-right">
              {minPrice !== null ? (
                <>
                  <p className="text-xs text-muted-foreground font-medium">Desde</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(minPrice)}</p>
                </>
              ) : (
                <p className="text-lg font-bold text-primary">{formatCurrency(event.price)}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <CardContent className={`${featured ? "p-6" : "p-5"}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="rounded-md bg-primary/10 px-2.5 py-1.5 text-center text-primary">
            <span className="block text-xs font-semibold uppercase">{eventDate.toLocaleDateString("es-AR", { month: "short", timeZone: "America/Argentina/Buenos_Aires" })}</span>
            <span className="block text-xl font-bold leading-none">{eventDate.toLocaleDateString("es-AR", { day: "numeric", timeZone: "America/Argentina/Buenos_Aires" })}</span>
          </div>
          <h3
            className={`flex-1 font-bold text-balance line-clamp-2 group-hover:text-primary transition-colors ${featured ? "text-2xl" : "text-xl"}`}
          >
            {event.title}
          </h3>
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground text-pretty line-clamp-2 mb-4">{event.description}</p>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm">
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <span className="text-foreground/80">
              {eventDate.toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "America/Argentina/Buenos_Aires",
              })}{" "}
              ·{" "}
              {eventDate.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Argentina/Buenos_Aires",
              })}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-sm">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            {event.location_url ? <a href={event.location_url} target="_blank" rel="noopener noreferrer" className="text-foreground/80 text-pretty line-clamp-1 underline-offset-4 hover:underline">{event.venue}</a> : <span className="text-foreground/80 text-pretty line-clamp-1">{event.venue}</span>}
          </div>

          <div className="flex items-center gap-2.5 text-sm">
            <Ticket className="h-4 w-4 text-primary shrink-0" />
            <span className="text-foreground/80">
              {realAvailableTickets} de {event.total_tickets} disponibles
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className={`border-t border-border/50 ${featured ? "p-6" : "p-5"} pt-4`}>
        <Button asChild disabled={!isAvailable} className="w-full group/btn" size={featured ? "lg" : "default"}>
          <Link href={`/events/${event.slug || event.id}`} className="flex items-center justify-center gap-2">
            {isAvailable ? "Comprar entradas" : "Ver detalles"}
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
