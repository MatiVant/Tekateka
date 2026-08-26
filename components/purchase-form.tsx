"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      const { createTicket } = await import("@/app/actions/create-ticket")
      const qrCode = `TICKET-${crypto.randomUUID()}`
      await createTicket({
        event_id: eventId,
        tier_id: null,
        buyer_name: name.trim(),
        buyer_email: email.trim().toLowerCase(),
        qr_code: qrCode,
        final_price: 0,
      })
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
