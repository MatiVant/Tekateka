"use client";

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPrice } from "@/lib/format";

interface Ticket {
  id: string;
  buyer_name: string;
  buyer_email: string;
  qr_code: string;
  status: string;
  purchased_at: string;
}

interface TicketsTableProps {
  tickets: Ticket[];
  eventPrice: number;
}

export function TicketsTable({ tickets, eventPrice }: TicketsTableProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setLoadingId(ticketId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (error) throw error;

      router.refresh();
    } catch (error) {
      console.error('[v0] Error al actualizar ticket:', error);
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" />Confirmada</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pendiente</Badge>;
      case 'used':
        return <Badge variant="outline">Usada</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No hay tickets vendidos para este evento aún
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">Comprador</th>
                <th className="text-left p-4 font-medium">Email</th>
                <th className="text-left p-4 font-medium">Código QR</th>
                <th className="text-left p-4 font-medium">Estado</th>
                <th className="text-left p-4 font-medium">Fecha</th>
                <th className="text-left p-4 font-medium">Precio</th>
                <th className="text-left p-4 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-t hover:bg-muted/30">
                  <td className="p-4">{ticket.buyer_name}</td>
                  <td className="p-4">{ticket.buyer_email}</td>
                  <td className="p-4 font-mono text-xs">{ticket.qr_code}</td>
                  <td className="p-4">{getStatusBadge(ticket.status)}</td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(ticket.purchased_at).toLocaleString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Argentina/Buenos_Aires',
                    })}
                  </td>
                  <td className="p-4 font-semibold">{formatPrice(eventPrice)}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {ticket.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(ticket.id, 'confirmed')}
                          disabled={loadingId === ticket.id}
                        >
                          Confirmar
                        </Button>
                      )}
                      {ticket.status === 'confirmed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(ticket.id, 'cancelled')}
                          disabled={loadingId === ticket.id}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center p-4 bg-muted/30 rounded-lg">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Total de tickets vendidos</p>
          <p className="text-2xl font-bold">{tickets.length}</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-sm text-muted-foreground">Ingresos confirmados</p>
          <p className="text-2xl font-bold text-green-600">
            {formatPrice(tickets.filter(t => t.status === 'confirmed').length * eventPrice)}
          </p>
        </div>
      </div>
    </div>
  );
}
