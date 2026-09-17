import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AllTicketsTable } from '@/components/admin/all-tickets-table';

export default async function AllTicketsPage() {
  const { authorized, user, profile } = await requireAuth(['organizer']);

  if (!authorized || !user) {
    redirect('/auth/login');
  }

  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      *,
      events!inner (
        id,
        title,
        price,
        organizer_id
      )
    `)
    .eq('events.organizer_id', user.id)
    .order('purchased_at', { ascending: false });

  const { data: events } = await supabase
    .from('events')
    .select('id, title')
    .eq('organizer_id', user.id)
    .order('title', { ascending: true });

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
            <CardTitle>Todas las Entradas</CardTitle>
            <CardDescription>
              Gestiona todas las entradas, confirma pagos y revisa comprobantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllTicketsTable tickets={tickets || []} events={events || []} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
