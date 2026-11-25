import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { EventForm } from '@/components/admin/event-form';
import { getAudienceTags } from '@/app/actions/audience-tags';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getMyPendingVenueProposals } from '@/lib/venue-proposals';

export default async function NewEventPage() {
  const { authorized, user, profile } = await requireAuth(['organizer', 'superadmin']);

  if (!authorized || !user) {
    redirect('/auth/login');
  }

  const audienceTags = await getAudienceTags()
  const [{ data: venues }, pendingVenueProposals] = await Promise.all([
    createAdminClient().from('venues').select('id, name, address').eq('active', true).order('name'),
    getMyPendingVenueProposals(user.id),
  ])

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
            <CardTitle>Crear Nuevo Evento</CardTitle>
            <CardDescription>
              Completa la información del evento que deseas publicar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventForm userId={user.id} isSuperadmin={profile?.role === "superadmin"} venues={venues ?? []} pendingVenueProposals={pendingVenueProposals} audienceTagOptions={audienceTags.filter((tag) => tag.active).map((tag) => tag.name)} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
