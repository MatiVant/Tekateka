import { QRScanner } from "@/components/verify/qr-scanner"
import { DoorSaleForm } from "@/components/verify/door-sale-form"
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
          <p className="mt-2 text-muted-foreground">Escaneá el QR o buscá la compra por el email del titular si no podés leerlo.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Verificar entrada</CardTitle><CardDescription>Este acceso temporal solo permite validar entradas del evento asociado.</CardDescription></CardHeader>
          <CardContent><QRScanner checkerToken={token} /><DoorSaleForm checkerToken={token} /></CardContent>
        </Card>
      </div>
    </main>
  )
}
