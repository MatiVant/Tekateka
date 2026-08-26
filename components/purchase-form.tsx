"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface PurchaseFormProps {
  eventId: string;
  userId?: string;
}

export function PurchaseForm({ eventId, userId }: PurchaseFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      // Verificar que el usuario está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Generar QR code único
      const qrCode = `TICKET-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Crear el ticket
      const { error: ticketError } = await supabase
        .from('tickets')
        .insert({
          event_id: eventId,
          buyer_id: user.id,
          buyer_name: name,
          buyer_email: email,
          qr_code: qrCode,
          status: 'pending',
        });

      if (ticketError) throw ticketError;

      // Actualizar tickets disponibles
      const { error: updateError } = await supabase.rpc('decrement_available_tickets', {
        event_id: eventId,
      });

      if (updateError) {
        // Si falla la actualización, intentamos con una consulta directa
        const { data: event } = await supabase
          .from('events')
          .select('available_tickets')
          .eq('id', eventId)
          .single();

        if (event) {
          await supabase
            .from('events')
            .update({ available_tickets: event.available_tickets - 1 })
            .eq('id', eventId);
        }
      }

      router.push('/my-tickets?success=true');
    } catch (error: unknown) {
      console.error('[v0] Error al comprar ticket:', error);
      setError(error instanceof Error ? error.message : "Error al procesar la compra");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre Completo</Label>
        <Input
          id="name"
          type="text"
          placeholder="Juan Pérez"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="tu@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Procesando...
          </>
        ) : (
          'Comprar Ahora'
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Al comprar, aceptas recibir un email con tu entrada y código QR
      </p>
    </form>
  );
}
