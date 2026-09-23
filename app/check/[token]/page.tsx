import { QRScanner } from "@/components/verify/qr-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Scan } from "lucide-react"

export default async function CheckerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><Scan className="h-8 w-8 text-primary" /></div>
          <h1 className="text-3xl font-bold">Control de acceso</h1>
          <p className="mt-2 text-muted-foreground">Escaneá el QR de cada entrada para validar el acceso.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Verificar entrada</CardTitle><CardDescription>Este acceso es temporal y solo permite controlar entradas del organizador.</CardDescription></CardHeader>
          <CardContent><QRScanner checkerToken={token} /></CardContent>
        </Card>
      </div>
    </main>
  )
}
