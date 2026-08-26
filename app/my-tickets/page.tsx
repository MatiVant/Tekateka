import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, CheckCircle, Clock, XCircle } from "lucide-react"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { QRCodeDisplay } from "@/components/qr-code-display"

export default async function MyTicketsPage() {
  const supabase = await createClient()
  const userData = await getCurrentUser()

  if (!userData) {
    redirect("/auth/login")
  }

  const { data: tickets } = await supabase
    .from("tickets")
    .select(`
      *,
      events (
        title,
        event_date,
        venue,
        price,
        image_url
      )
    `)
    .eq("buyer_id", userData.user.id)
    .order("purchased_at", { ascending: false })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            Confirmada
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pendiente
          </Badge>
        )
      case "used":
        return <Badge variant="outline">Usada</Badge>
      case "cancelled":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Cancelada
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Mis Entradas</h1>

        {tickets && tickets.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tickets.map((ticket: any) => (
              <Card key={ticket.id} className="overflow-hidden">
                <div className="aspect-video relative overflow-hidden bg-muted">
                  <img
                    src={
                      ticket.events.image_url ||
                      `/placeholder.svg?height=300&width=500&query=evento+${encodeURIComponent(ticket.events.title)}`
                    }
                    alt={ticket.events.title}
                    className="object-cover w-full h-full"
                  />
                </div>

                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl text-pretty">{ticket.events.title}</CardTitle>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <CardDescription>Comprador: {ticket.buyer_name}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {new Date(ticket.events.event_date).toLocaleDateString("es-ES", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-pretty">{ticket.events.venue}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Código QR para verificación:</p>
                    <QRCodeDisplay qrCode={ticket.qr_code} />
                    <p className="text-xs text-muted-foreground mt-2 text-center">{ticket.qr_code}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-2">No tienes entradas aún</p>
              <p className="text-sm text-muted-foreground">Explora nuestros eventos y compra tu primera entrada</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
