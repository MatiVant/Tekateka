import { redirect, notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Link2, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { AllTicketsTable } from '@/components/admin/all-tickets-table';
import { getEventReconciliations, getEventSettlement } from '@/app/actions/event-settlement';
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
  const [initialSettlement, reconciliations] = await Promise.all([getEventSettlement(id), getEventReconciliations(id)]);

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
      ),
      ticket_tiers(name, promotion_type),
      ticket_promotions(promotion_codes(code, promotion_type, discount_value))
    `)
    .eq('event_id', id)
    .order('purchased_at', { ascending: false });

  const adminSupabase = createAdminClient();
  const { data: doorSales } = await adminSupabase
    .from('door_sales')
    .select('id, quantity, unit_price, buyer_name, buyer_note, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-muted/30">
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col gap-4">
          <Button variant="ghost" asChild className="w-fit">
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Panel
            </Link>
          </Button>
          <div className="grid gap-3 rounded-2xl border border-[#e7dcc8] bg-card p-3 sm:grid-cols-3">
            <CheckerLinkButton eventId={id} />
            <Button asChild variant="outline" size="lg" className="h-auto min-h-16 w-full justify-center gap-2 rounded-xl border-[#d8c9b4] bg-background px-4 py-3 text-center whitespace-normal hover:bg-muted/50">
              <Link href={`/verify?event=${encodeURIComponent(id)}`}>
                <ScanLine className="h-5 w-5 shrink-0" />
                <span>Escanear QR</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-auto min-h-16 w-full justify-center gap-2 rounded-xl border-[#d8c9b4] bg-background px-4 py-3 text-center whitespace-normal hover:bg-muted/50">
              <Link href={`/admin/events/${id}/tickets/links`}>
                <Link2 className="h-5 w-5 shrink-0" />
                <span>Accesos para colaboradores</span>
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
              <h2 id="sold-tickets-title" className="mb-1 text-lg font-semibold">Entradas pendientes</h2>
              <p className="mb-4 text-sm text-muted-foreground">Las pendientes aparecen primero para que puedas revisarlas y aprobarlas.</p>
              <AllTicketsTable
                tickets={tickets || []}
                doorSales={doorSales || []}
                fixedEventId={id}
                initialView="pending"
                canRestoreUsedTickets={profile?.role === 'superadmin'}
              />
            </section>
            <EventSettlement eventId={id} tickets={tickets || []} doorSales={doorSales || []} initialSettlement={initialSettlement} initialReconciliations={reconciliations} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
