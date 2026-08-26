import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, User, Mail, Ticket } from 'lucide-react';

interface TicketDetailsProps {
  ticket: {
    buyer_name: string;
    buyer_email: string;
    qr_code: string;
    status: string;
    purchased_at: string;
    events: {
      title: string;
      event_date: string;
      venue: string;
    };
  };
}

export function TicketDetails({ ticket }: TicketDetailsProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500">Confirmada</Badge>;
      case 'used':
        return <Badge variant="outline">Usada</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">Detalles del Ticket</CardTitle>
          {getStatusBadge(ticket.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Ticket className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-semibold text-pretty">{ticket.events.title}</p>
              <p className="text-sm text-muted-foreground">Evento</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">
                {new Date(ticket.events.event_date).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-sm text-muted-foreground">Fecha y hora</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium text-pretty">{ticket.events.venue}</p>
              <p className="text-sm text-muted-foreground">Ubicación</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">{ticket.buyer_name}</p>
              <p className="text-sm text-muted-foreground">Comprador</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">{ticket.buyer_email}</p>
              <p className="text-sm text-muted-foreground">Email</p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-1">Código QR</p>
          <p className="font-mono text-sm">{ticket.qr_code}</p>
        </div>

        <div className="pt-2">
          <p className="text-xs text-muted-foreground">
            Comprado el{' '}
            {new Date(ticket.purchased_at).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
