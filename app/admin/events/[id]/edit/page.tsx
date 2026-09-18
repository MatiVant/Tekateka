import { redirect, notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings, Ticket } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { EventForm } from "@/components/admin/event-form"
import { EventOwnershipTransfer } from "@/components/admin/event-ownership-transfer"
import { getPendingTransfersForEvent } from "@/app/actions/event-ownership-transfer"

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { authorized, user, profile } = await requireAuth(["organizer"])

  if (!authorized || !user) {
    redirect("/auth/login")
  }

  const supabase = await createClient()
  const currentTransfer = await getPendingTransfersForEvent(id)

  const { data: event } = await supabase.from("events").select("*").eq("id", id).eq("organizer_id", user.id).single()

  if (!event) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-muted/30">

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Panel
            </Link>
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/admin/events/${id}/settings`}>
                <Settings className="mr-2 h-4 w-4" />
                Configuración de entradas y cupones
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/admin/events/${id}/tickets`}>
                <Ticket className="mr-2 h-4 w-4" />
                Ver Tickets
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Editar Evento</CardTitle>
            <CardDescription>Actualiza la información del evento</CardDescription>
          </CardHeader>
          <CardContent>
            <EventForm userId={user.id} event={event} />
          </CardContent>
        </Card>

        <EventOwnershipTransfer eventId={id} currentTransfer={currentTransfer} />
      </main>
    </div>
  )
}
