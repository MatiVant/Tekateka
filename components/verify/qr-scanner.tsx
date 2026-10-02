"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Camera, Keyboard, Search, UserRoundCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TicketDetails } from './ticket-details';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ManualTicket = {
  id: string;
  buyer_name: string | null;
  status: string;
  purchased_at: string | null;
};

interface QRScannerProps {
  userId?: string;
  eventId?: string;
  checkerToken?: string;
}

export function QRScanner({ userId, eventId, checkerToken }: QRScannerProps) {
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual');
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const [manualTickets, setManualTickets] = useState<ManualTicket[]>([]);
  const [manualLookupError, setManualLookupError] = useState<string | null>(null);
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [ticketToCheckIn, setTicketToCheckIn] = useState<ManualTicket | null>(null);
  const [isManualCheckInPending, setIsManualCheckInPending] = useState(false);
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    ticket?: {
      buyer_name: string;
      buyer_email: string;
      qr_code: string;
      status: string;
      purchased_at: string;
      events: { title: string; event_date: string; venue: string };
    };
  } | null>(null);

  const verifyTicket = useCallback(async (qrCode: string) => {
    setIsScanning(true);
    setResult(null);

    try {
      if (checkerToken) {
        const response = await fetch('/api/check-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: checkerToken, qrCode: qrCode.trim() }) })
        const payload = await response.json()
        if (!response.ok) {
          setResult({ type: 'error', message: payload.error || 'No se pudo verificar' })
          return
        }
        setResult({ type: payload.type, message: payload.message, ticket: payload.ticket })
        return
      }

      const supabase = createClient();

      // Buscar el ticket por QR code
      let ticketQuery = supabase
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
      if (eventId) ticketQuery = ticketQuery.eq('event_id', eventId)
      const { data: ticket, error: ticketError } = await ticketQuery.single()


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
      const { data: updatedTicket, error: updateError } = await supabase
        .from('tickets')
        .update({
          status: 'used',
          verified_at: new Date().toISOString(),
          verified_by: userId,
        })
        .eq('id', ticket.id)
        .eq('status', 'confirmed')
        .select('id')
        .maybeSingle()

      if (updateError) throw updateError
      if (!updatedTicket) {
        setResult({ type: 'warning', message: 'Este ticket ya fue utilizado anteriormente.', ticket: { ...ticket, status: 'used' } })
        return
      }

      setResult({
        type: 'success',
        message: 'Ticket válido. Entrada verificada correctamente.',
        ticket: { ...ticket, status: 'used' },
      });
    } catch (error) {
      console.error('[v0] Error al verificar ticket:', error);
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error al verificar el ticket. Intente nuevamente.',
      });
    } finally {
      setIsScanning(false);
    }
  }, [checkerToken, eventId, userId]);

  useEffect(() => {
    if (scanMode !== 'camera' || result) return;
    let active = true;
    const startCamera = async () => {
      setCameraError(null);
      const BarcodeDetectorClass = (window as Window & { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
      if (!BarcodeDetectorClass) {
        setCameraError('Tu navegador no permite detectar QR desde la cámara. Usá el modo manual.');
        return;
      }
      try {
        const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        streamRef.current = stream;
        if (!videoRef.current || !active) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const scan = async () => {
          if (!active || !videoRef.current) return;
          const codes = await detector.detect(videoRef.current);
          const value = codes[0]?.rawValue;
          if (value) {
            const match = value.match(/\/ticket\/([^/?#]+)/);
            await verifyTicket(decodeURIComponent(match?.[1] ?? value));
            return;
          }
          scanFrameRef.current = requestAnimationFrame(scan);
        };
        scanFrameRef.current = requestAnimationFrame(scan);
      } catch (error) {
        console.error('[v0] Error al iniciar lector QR:', error);
        setCameraError('No se pudo acceder a la cámara. Revisá los permisos o usá el modo manual.');
      }
    };
    void startCamera();
    return () => {
      active = false;
      if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [scanMode, result, verifyTicket]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      verifyTicket(manualCode);
      setManualCode('');
    }
  };

  const searchManualTickets = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkerToken || !manualEmail.trim() || isSearchingManual) return;
    setIsSearchingManual(true);
    setManualLookupError(null);
    setManualTickets([]);
    try {
      const response = await fetch('/api/check-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: checkerToken, action: 'search_by_email', email: manualEmail.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron buscar las entradas.');
      setManualTickets(payload.tickets ?? []);
      if (!payload.tickets?.length) setManualLookupError('No encontramos entradas con ese email para este evento. Revisá que esté escrito igual al de la compra.');
    } catch (error) {
      setManualLookupError(error instanceof Error ? error.message : 'No se pudieron buscar las entradas.');
    } finally {
      setIsSearchingManual(false);
    }
  };

  const confirmManualCheckIn = async () => {
    if (!checkerToken || !ticketToCheckIn || isManualCheckInPending) return;
    setIsManualCheckInPending(true);
    try {
      const response = await fetch('/api/check-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: checkerToken, action: 'manual_check_in', ticketId: ticketToCheckIn.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo registrar el ingreso.');
      if (payload.type !== 'success') {
        setManualLookupError(payload.message || 'La entrada no se pudo marcar como usada.');
        setManualTickets((current) => current.map((ticket) => ticket.id === ticketToCheckIn.id ? { ...ticket, status: payload.ticket?.status ?? ticket.status } : ticket));
        setTicketToCheckIn(null);
        return;
      }
      setTicketToCheckIn(null);
      setManualSearchOpen(false);
      setManualTickets([]);
      setManualEmail('');
      setResult({ type: 'success', message: payload.message, ticket: payload.ticket });
    } catch (error) {
      setManualLookupError(error instanceof Error ? error.message : 'No se pudo registrar el ingreso.');
      setTicketToCheckIn(null);
    } finally {
      setIsManualCheckInPending(false);
    }
  };

  const handleScanAgain = () => {
    setResult(null);
    setManualCode('');
    setManualLookupError(null);
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
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
              }}
              autoFocus
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Ingresa el código QR manualmente o escanéalo
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isScanning || !manualCode.trim()}>
            {isScanning ? 'Verificando...' : 'Verificar entrada'}
          </Button>
        </form>
      )}

      {checkerToken && scanMode === 'manual' && !result && (
        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={manualSearchOpen}
            onClick={() => {
              setManualSearchOpen((open) => !open);
              setManualLookupError(null);
            }}
          >
            <span className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRoundCheck aria-hidden="true" /></span>
              <span>
                <span className="block font-medium">¿No se puede leer el QR?</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">Buscá la compra por el email del titular.</span>
              </span>
            </span>
            <Search aria-hidden="true" className="shrink-0 text-muted-foreground" />
          </button>

          {manualSearchOpen && (
            <div className="mt-5 border-t pt-5">
              <form onSubmit={searchManualTickets} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="manual-buyer-email">Email usado en la compra</Label>
                  <Input
                    id="manual-buyer-email"
                    type="email"
                    autoComplete="off"
                    required
                    maxLength={254}
                    placeholder="nombre@correo.com"
                    value={manualEmail}
                    onChange={(event) => setManualEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
                    }}
                  />
                </div>
                <Button type="submit" variant="outline" disabled={isSearchingManual || !manualEmail.trim()}>
                  <Search data-icon="inline-start" />
                  {isSearchingManual ? 'Buscando…' : 'Buscar entradas'}
                </Button>
              </form>

              {manualLookupError && <p role="alert" className="mt-3 text-sm text-destructive">{manualLookupError}</p>}

              {manualTickets.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2" aria-label="Entradas encontradas">
                  {manualTickets.map((ticket) => {
                    const canCheckIn = ticket.status === 'confirmed';
                    const statusLabel = ticket.status === 'confirmed' ? 'Lista para ingresar' : ticket.status === 'used' ? 'Ya utilizada' : ticket.status === 'cancelled' ? 'Cancelada' : 'Pendiente';
                    return (
                      <li key={ticket.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{ticket.buyer_name || 'Titular sin nombre'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Compra {ticket.purchased_at ? new Date(ticket.purchased_at).toLocaleDateString('es-AR') : ''}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={ticket.status === 'used' ? 'secondary' : canCheckIn ? 'outline' : 'destructive'}>{statusLabel}</Badge>
                          {canCheckIn && (
                            <Button type="button" size="sm" onClick={() => setTicketToCheckIn(ticket)}>
                              <CheckCircle data-icon="inline-start" /> Registrar ingreso
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      <AlertDialog open={Boolean(ticketToCheckIn)} onOpenChange={(open) => { if (!open && !isManualCheckInPending) setTicketToCheckIn(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Registrar este ingreso?</AlertDialogTitle>
            <AlertDialogDescription>
              {ticketToCheckIn
                ? `La entrada de ${ticketToCheckIn.buyer_name || 'este titular'} se marcará como usada. Esta acción no se puede deshacer desde el lector.`
                : 'La entrada se marcará como usada. Esta acción no se puede deshacer desde el lector.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isManualCheckInPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmManualCheckIn(); }} disabled={isManualCheckInPending}>
              {isManualCheckInPending ? 'Registrando…' : 'Sí, registrar ingreso'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modo cámara */}
      {scanMode === 'camera' && !result && (
        <div className="space-y-4">
          {cameraError ? <Alert variant="destructive"><Camera className="h-4 w-4" /><AlertDescription>{cameraError}</AlertDescription></Alert> : <div className="overflow-hidden rounded-xl border bg-black"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /><p className="p-3 text-center text-sm text-white">Apuntá la cámara al QR de la entrada</p></div>}
          <Button type="button" variant="outline" className="w-full" onClick={() => setScanMode('manual')}>Usar modo manual</Button>
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
