"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Camera, Keyboard } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TicketDetails } from './ticket-details';

interface QRScannerProps {
  userId: string;
}

export function QRScanner({ userId }: QRScannerProps) {
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual');
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    ticket?: any;
  } | null>(null);

  const verifyTicket = async (qrCode: string) => {
    setIsScanning(true);
    setResult(null);

    try {
      const supabase = createClient();

      // Buscar el ticket por QR code
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          events (
            id,
            title,
            event_date,
            venue,
            organizer_id
          )
        `)
        .eq('qr_code', qrCode.trim())
        .single();

      if (ticketError || !ticket) {
        setResult({
          type: 'error',
          message: 'Código QR no válido. Este ticket no existe en el sistema.',
        });
        return;
      }

      // Verificar el estado del ticket
      if (ticket.status === 'used') {
        setResult({
          type: 'warning',
          message: 'Este ticket ya fue utilizado anteriormente.',
          ticket,
        });
        return;
      }

      if (ticket.status === 'cancelled') {
        setResult({
          type: 'error',
          message: 'Este ticket ha sido cancelado y no es válido.',
          ticket,
        });
        return;
      }

      if (ticket.status === 'pending') {
        setResult({
          type: 'warning',
          message: 'Ticket pendiente de confirmación de pago. Contacte al organizador.',
          ticket,
        });
        return;
      }

      // Ticket válido - marcarlo como usado
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          status: 'used',
          verified_at: new Date().toISOString(),
          verified_by: userId,
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      setResult({
        type: 'success',
        message: 'Ticket válido. Entrada verificada correctamente.',
        ticket: { ...ticket, status: 'used' },
      });
    } catch (error) {
      console.error('[v0] Error al verificar ticket:', error);
      setResult({
        type: 'error',
        message: 'Error al verificar el ticket. Intente nuevamente.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      verifyTicket(manualCode);
      setManualCode('');
    }
  };

  const handleScanAgain = () => {
    setResult(null);
    setManualCode('');
  };

  return (
    <div className="space-y-6">
      {/* Selector de modo */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <Button
          type="button"
          variant={scanMode === 'manual' ? 'default' : 'ghost'}
          className="flex-1"
          onClick={() => setScanMode('manual')}
        >
          <Keyboard className="mr-2 h-4 w-4" />
          Manual
        </Button>
        <Button
          type="button"
          variant={scanMode === 'camera' ? 'default' : 'ghost'}
          className="flex-1"
          onClick={() => setScanMode('camera')}
        >
          <Camera className="mr-2 h-4 w-4" />
          Cámara
        </Button>
      </div>

      {/* Modo manual */}
      {scanMode === 'manual' && !result && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qrCode">Código QR del Ticket</Label>
            <Input
              id="qrCode"
              type="text"
              placeholder="TICKET-XXXXX-XXXXX"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              autoFocus
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Ingresa el código QR manualmente o escanéalo
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isScanning || !manualCode.trim()}>
            {isScanning ? 'Verificando...' : 'Verificar Ticket'}
          </Button>
        </form>
      )}

      {/* Modo cámara */}
      {scanMode === 'camera' && !result && (
        <div className="space-y-4">
          <Alert>
            <Camera className="h-4 w-4" />
            <AlertDescription>
              La funcionalidad de escaneo por cámara requiere permisos de acceso a la cámara.
              Por ahora, puedes usar el modo manual para ingresar el código.
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setScanMode('manual')}
          >
            Usar Modo Manual
          </Button>
        </div>
      )}

      {/* Resultado de verificación */}
      {result && (
        <div className="space-y-4">
          <Alert
            variant={result.type === 'error' ? 'destructive' : 'default'}
            className={
              result.type === 'success'
                ? 'border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100'
                : result.type === 'warning'
                ? 'border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100'
                : ''
            }
          >
            {result.type === 'success' && <CheckCircle className="h-5 w-5" />}
            {result.type === 'error' && <XCircle className="h-5 w-5" />}
            {result.type === 'warning' && <AlertTriangle className="h-5 w-5" />}
            <AlertDescription className="font-medium">
              {result.message}
            </AlertDescription>
          </Alert>

          {result.ticket && <TicketDetails ticket={result.ticket} />}

          <Button onClick={handleScanAgain} className="w-full">
            Escanear Otro Ticket
          </Button>
        </div>
      )}
    </div>
  );
}
