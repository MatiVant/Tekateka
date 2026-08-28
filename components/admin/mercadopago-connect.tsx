import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, CreditCard } from "lucide-react"

export function MercadoPagoConnect({ connected = false, isSuperadmin = false }: { connected?: boolean; isSuperadmin?: boolean }) {
  return (
    <section className="mb-8 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-1 h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Cobros con Mercado Pago</h2>
          <p className="text-sm text-muted-foreground">{isSuperadmin ? "Conectá tu cuenta para recibir pagos de tus propios eventos." : "Conectá tu cuenta para recibir pagos de tus eventos."}</p>
        </div>
      </div>
      {connected ? <span className="inline-flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />Cuenta conectada</span> : <Button asChild><Link href="/api/mercadopago/oauth/connect">Conectar Mercado Pago</Link></Button>}
    </section>
  )
}
