import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, MapPin, Ticket, ArrowLeft, Clock } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { PurchaseFlow } from "@/components/purchase-flow"
import { formatCurrency } from "@/lib/format"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function canViewPastEvent(organizerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  return profile?.role === "superadmin" || (profile?.role === "organizer" && user.id === organizerId)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const eventQuery = /^[0-9a-f-]{36}$/i.test(id)
    ? supabase.from("events").select("title, description, image_url, image_position_x, image_position_y, venue, event_date, organizer_id").eq("id", id).maybeSingle()
    : supabase.from("events").select("title, description, image_url, image_position_x, image_position_y, venue, event_date, organizer_id").eq("slug", id).maybeSingle()
  const { data: event } = await eventQuery
  if (!event) return { title: "Evento | TekaTeka" }
  if (new Date(event.event_date).getTime() < Date.now() && !(await canViewPastEvent(event.organizer_id))) {
    return { title: "Evento no disponible | TekaTeka" }
  }
  const date = new Date(event.event_date).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" })
  return { title: `${event.title} | TekaTeka`, description: event.description || `${event.title} - ${date} en ${event.venue}`, openGraph: { title: event.title, description: event.description || `${date} en ${event.venue}`, images: event.image_url ? [event.image_url] : undefined } }
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const eventQuery = /^[0-9a-f-]{36}$/i.test(id)
    ? supabase.from("events").select("*").eq("id", id).maybeSingle()
    : supabase.from("events").select("*").eq("slug", id).maybeSingle()
  const { data: event, error } = await eventQuery

  if (error || !event) {
    console.error("[v0] Error fetching event:", error)
    notFound()
  }
  if (new Date(event.event_date).getTime() < Date.now() && !(await canViewPastEvent(event.organizer_id))) {
    notFound()
  }

  const { count: confirmedTickets } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("status", "confirmed")
  const confirmedCount = confirmedTickets ?? 0
  const realAvailableTickets = Math.max(0, event.total_tickets - confirmedCount)
  const eventDate = new Date(event.event_date)
  const now = Date.now()
  const beforeSalesStart = event.sales_start_at && now < new Date(event.sales_start_at).getTime()
  const afterSalesEnd = event.sales_end_at && now >= new Date(event.sales_end_at).getTime()
  const eventHasStarted = now >= eventDate.getTime()
  const isAvailable = event.status === "active" && realAvailableTickets > 0 && !beforeSalesStart && !afterSalesEnd && !eventHasStarted

  const isFree = event.price === 0 || event.price === null
  const isPwyw = event.is_pay_what_you_want === true

  const { data: minPriceTier } = await supabase
    .from("ticket_tiers")
    .select("base_price")
    .eq("event_id", event.id)
    .order("base_price", { ascending: true })
    .limit(1)
    .maybeSingle()

  const displayPrice = minPriceTier ? minPriceTier.base_price : event.price

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Eventos
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="aspect-video relative overflow-hidden rounded-lg bg-muted mb-6">
              <Image
                src={event.image_url || `/placeholder.svg?height=600&width=1000&query=evento+${encodeURIComponent(event.title)}`}
                alt={event.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover"
                style={{ objectPosition: `${event.image_position_x ?? 50}% ${event.image_position_y ?? 50}%` }}
              />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-balance">{event.title}</h1>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg">
                  {eventDate.toLocaleDateString("es-AR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "America/Argentina/Buenos_Aires",
                  })}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg">
                  {eventDate.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Argentina/Buenos_Aires",
                  })}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg text-pretty">{event.venue}</span>
              </div>

              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg">
                  {realAvailableTickets} entradas disponibles de {event.total_tickets}
                </span>
              </div>
            </div>

            {event.description && (
              <div className="prose prose-lg max-w-none">
                <h2 className="text-2xl font-semibold mb-3">Descripción</h2>
                <p className="text-muted-foreground text-pretty leading-relaxed">{event.description}</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="text-2xl">Comprar Entrada</CardTitle>
                <CardDescription>
                  {isAvailable ? "Solo necesitas tu email y nombre completo" : "Este evento no está disponible"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-6">
                  {isFree && "Gratis"}
                  {isPwyw && !isFree && "A la gorra"}
                  {!isFree && !isPwyw && (
                    <div className="flex flex-col">
                      {minPriceTier && (
                        <span className="text-sm font-normal text-muted-foreground">Entradas desde</span>
                      )}
                      <span>{formatCurrency(displayPrice)}</span>
                    </div>
                  )}
                </div>

                {isAvailable ? (
                  <PurchaseFlow
                    eventId={event.id}
                    eventTitle={event.title}
                    eventPrice={Number(event.price)}
  paymentInstructions={event.payment_instructions || undefined}
  paymentMethods={event.payment_methods}
  transferAlias={event.transfer_alias}
  transferAccountHolder={event.transfer_account_holder}
  mercadoPagoLink={event.mercado_pago_link}
                    isFree={isFree}
                    isPwyw={isPwyw}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {beforeSalesStart
                      ? `La venta comienza el ${new Date(event.sales_start_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}.`
                      : afterSalesEnd
                        ? "La venta para este evento ya finalizó."
                        : event.status === "sold_out"
                          ? "Las entradas para este evento están agotadas."
                          : "Este evento ya no está disponible para compra."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
