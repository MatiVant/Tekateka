import { redirect, notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AllTicketsTable } from '@/components/admin/all-tickets-table';
import { ArtistShareLinks } from '@/components/admin/artist-share-links';
import { getArtistShareLinks } from '@/app/actions/artist-share-links';

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
  const shareLinks = await getArtistShareLinks(id);

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
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Panel
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Tickets: {event.title}</CardTitle>
            <CardDescription>
              Gestiona las entradas vendidas y confirma los pagos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ArtistShareLinks eventId={id} initialLinks={shareLinks} />
            <AllTicketsTable tickets={tickets || []} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
