import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Ticket, ChevronRight } from "lucide-react"
import { ProfileForm } from "@/components/profile/profile-form"

export default async function ProfilePage() {
  const userData = await getCurrentUser()

  if (!userData) {
    redirect("/auth/login")
  }

  const { user, profile } = userData

  return (
    <div className="min-h-screen">
      <main className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Mi Perfil</h1>
          <p className="mt-2 text-muted-foreground">Actualizá tus datos de contacto y preferencias.</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Información personal</CardTitle>
            <CardDescription>Estos datos nos permiten identificarte y contactarte.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              email={user.email || ""}
              role={profile?.role || "user"}
              initialFullName={profile?.full_name || ""}
              initialPhone={profile?.phone || ""}
              initialPaymentInfo={profile?.payment_info || ""}
            />
          </CardContent>
        </Card>

        <Link href="/my-tickets" className="block">
          <Card className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-center justify-between py-6">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Mis Entradas</p>
                  <p className="text-sm text-muted-foreground">Revisá y mostrá los códigos QR de tus compras.</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </main>
    </div>
  )
}
