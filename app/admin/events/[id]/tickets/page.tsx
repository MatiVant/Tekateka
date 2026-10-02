import { redirect, notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Link2, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AllTicketsTable } from '@/components/admin/all-tickets-table';
import { getEventSettlement } from '@/app/actions/event-settlement';
import { EventSettlement } from '@/components/admin/event-settlement';
import { CheckerLinkButton } from '@/components/admin/checker-link-button';

export default async function EventTicketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { authorized, user, profile } = await requireAuth(['organizer']);

  if (!authorized || !user) {
    redirect('/auth/login');
  }

  const supabase = await createClient();

  // Los superadmins pueden consultar las ventas de cualquier evento; los organizadores solo los propios.
  let eventQuery = supabase.from('events').select('*').eq('id', id);
  if (profile?.role !== 'superadmin') {
    eventQuery = eventQuery.eq('organizer_id', user.id);
  }
  const { data: event } = await eventQuery.single();

  if (!event) {
    notFound();
  }

  // Obtener tickets del evento
  const initialSettlement = await getEventSettlement(id);

  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      *,
      events (
        id,
        title,
        event_date,
        venue,
        price
      )
    `)
    .eq('event_id', id)
    .order('purchased_at', { ascending: false });

  return (
    <div className="min-h-screen bg-muted/30">
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" asChild className="w-fit">
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Panel
            </Link>
          </Button>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-start">
            <CheckerLinkButton eventId={id} />
            <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
              <Link href={`/admin/events/${id}/tickets/links`}>
                <Link2 className="h-4 w-4" />
                Accesos para colaboradores
              </Link>
            </Button>
            <Button asChild size="lg" className="w-full gap-2 rounded-full font-bold shadow-lg shadow-primary/20 sm:w-auto">
              <Link href={`/verify?event=${encodeURIComponent(id)}`}>
                <ScanLine className="h-5 w-5" />
                Escanear QR de entradas
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Tickets: {event.title}</CardTitle>
            <CardDescription>
              Gestiona las entradas vendidas y confirma los pagos
            </CardDescription></div></div>
          </CardHeader>
          <CardContent>
            <section aria-labelledby="sold-tickets-title" className="mb-8">
              <h2 id="sold-tickets-title" className="mb-1 text-lg font-semibold">Entradas vendidas</h2>
              <p className="mb-4 text-sm text-muted-foreground">Revisá las compras y el estado de cada entrada.</p>
              <AllTicketsTable tickets={tickets || []} canRestoreUsedTickets={profile?.role === 'superadmin'} />
            </section>
            <EventSettlement eventId={id} tickets={tickets || []} initialSettlement={initialSettlement} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
