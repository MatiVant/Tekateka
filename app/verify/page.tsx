import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QRScanner } from '@/components/verify/qr-scanner';
import { Scan } from 'lucide-react';
import { DoorSaleForm } from '@/components/verify/door-sale-form';
import { createClient } from '@/lib/supabase/server';

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  const [{ event }, { authorized, user, profile }] = await Promise.all([
    searchParams,
    requireAuth(['organizer', 'superadmin']),
  ])
  const eventId = Array.isArray(event) ? event[0] : event

  if (!authorized || !user) {
    redirect('/auth/login');
  }

  const navbarUser = user.email ? { email: user.email } : null
  const supabase = await createClient()
  const { data: selectedEvent } = eventId ? await supabase.from('events').select('door_ticket_price').eq('id', eventId).maybeSingle() : { data: null }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar user={navbarUser} profile={profile} />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Scan className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Verificación de Tickets</h1>
            <p className="text-muted-foreground">
              Escanea el código QR de la entrada para verificar su validez
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Escanear Código QR</CardTitle>
              <CardDescription>
                Coloca el código QR del ticket frente a la cámara
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QRScanner userId={user.id} eventId={eventId} />
              <DoorSaleForm eventId={eventId} defaultPrice={selectedEvent?.door_ticket_price} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
