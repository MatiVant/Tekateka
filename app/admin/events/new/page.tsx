import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { EventForm } from '@/components/admin/event-form';

export default async function NewEventPage() {
  const { authorized, user, profile } = await requireAuth(['organizer']);

  if (!authorized || !user) {
    redirect('/auth/login');
  }

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
            <EventForm userId={user.id} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
