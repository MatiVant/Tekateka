import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from 'lucide-react';
import Link from "next/link";

export default function SignUpSuccessPage({
  searchParams,
}: {
  searchParams: { organizer?: string };
}) {
  const isOrganizer = searchParams.organizer === 'true';

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-muted/30">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              {isOrganizer ? '¡Registro Pendiente!' : '¡Registro Exitoso!'}
            </CardTitle>
            <CardDescription>
              {isOrganizer ? (
                <>
                  Tu solicitud para ser organizador ha sido recibida.
                  <br />
                  Un administrador revisará tu cuenta y recibirás un email cuando sea aprobada.
                </>
              ) : (
                <>
                  Por favor, revisa tu correo electrónico para confirmar tu cuenta.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {isOrganizer && (
              <div className="mb-4 p-4 bg-muted rounded-lg text-sm text-left">
                <p className="font-semibold mb-2">Próximos pasos:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Confirma tu email haciendo clic en el enlace</li>
                  <li>Espera la aprobación del administrador</li>
                  <li>Recibirás un email cuando seas aprobado</li>
                  <li>Podrás crear tu primer evento gratis</li>
                </ul>
              </div>
            )}
            <Button asChild className="w-full">
              <Link href="/auth/login">Ir al Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
