import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BarChart3, CheckCircle2, CircleHelp, ClipboardList, Eye, Gift, LayoutDashboard, Link2, Plus, Repeat2, ShieldCheck, Ticket, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Ayuda y guía de uso | TekaTeka",
  description: "Manual para productores, artistas y compradores de TekaTeka.",
}

const sections = [
  { id: "productores", label: "Productores", icon: LayoutDashboard },
  { id: "artistas", label: "Artistas", icon: Users },
  { id: "compradores", label: "Compradores", icon: Ticket },
  { id: "soporte", label: "Preguntas frecuentes", icon: CircleHelp },
]

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-muted/20">
      <section className="border-b bg-background">
        <div className="container mx-auto grid gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_280px] lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-5">Centro de ayuda</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Todo lo que necesitás para empezar con TekaTeka</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Una guía rápida para publicar eventos, vender entradas, revisar pagos y compartir información con artistas. Podés consultar esta ayuda sin tener una cuenta.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild><Link href="/auth/sign-up">Crear una cuenta <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button variant="outline" asChild><Link href="/">Ver eventos</Link></Button>
            </div>
          </div>
          <nav aria-label="Secciones de ayuda" className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">En esta guía</p>
            <div className="grid gap-1">
              {sections.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Icon className="h-4 w-4" />{label}</a>)}
            </div>
          </nav>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section id="productores" className="scroll-mt-8">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><LayoutDashboard className="h-5 w-5" /></div><div><h2 className="text-2xl font-bold">Para productores</h2><p className="text-muted-foreground">Organizá todo el ciclo de tu evento desde un solo lugar.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            <GuideCard icon={Plus} title="1. Creá tu evento" text="Cargá nombre, fecha, lugar, descripción, imagen y precio. También podés configurar distintos tipos de entrada, promociones y métodos de pago." />
            <GuideCard icon={Ticket} title="2. Publicá y vendé" text="Compartí el enlace del evento. Los compradores completan sus datos, eligen la cantidad y pagan por Mercado Pago o transferencia." />
            <GuideCard icon={ClipboardList} title="3. Revisá las ventas" text="Desde Ventas podés filtrar por evento, buscar compradores y ver el estado de cada entrada, su comprobante y medio de pago." />
            <GuideCard icon={CheckCircle2} title="4. Confirmá pagos" text="Seleccioná una o varias entradas para aprobarlas o rechazarlas. Si rechazás, podés informar el motivo al comprador." />
            <GuideCard icon={BarChart3} title="5. Consultá el resumen" text="El panel muestra entradas confirmadas, pendientes y el resumen económico. Los movimientos detallados están disponibles desde su informe separado." />
            <GuideCard icon={Link2} title="6. Compartí con artistas" text="Generá un enlace privado por evento. Podés permitir que el artista vea quién compró, incluyendo teléfono si el comprador lo informó, o dejar solo los totales." />
          </div>

          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Gift className="h-5 w-5" /></div>
              <div className="w-full">
                <h3 className="text-xl font-bold">Cómo usar los códigos de promoción</h3>
                <p className="mt-1 text-sm text-muted-foreground">Creá códigos desde la configuración del evento y compartilos con tu público.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <PromoGuide icon={Gift} title="Entrada gratis o 100%" text="El comprador obtiene una sola entrada sin pagar. No verá transferencia ni Mercado Pago: la entrada se confirma directamente como gratuita." />
                  <PromoGuide icon={Ticket} title="Descuento parcial" text="El comprador obtiene una sola entrada y paga el importe final luego del descuento. Ese es el valor que verá en el resumen y en la transferencia." />
                  <PromoGuide icon={Repeat2} title="2x1" text="El comprador recibe exactamente 2 entradas y paga el valor de 1. La cantidad se fija automáticamente y no puede modificarse mientras el código esté aplicado." />
                </div>
                <div className="mt-5 rounded-xl border bg-background/70 p-4 text-sm leading-6">
                  <p className="font-semibold">Para crear un 2x1</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                    <li>Entrá al evento como administrador.</li>
                    <li>Abrí <strong className="text-foreground">Códigos de promoción</strong> y creá uno nuevo.</li>
                    <li>Elegí el tipo <strong className="text-foreground">2x1 (Paga 1, lleva 2)</strong>.</li>
                    <li>Definí el código, el límite de usos y, si querés, las fechas de vigencia.</li>
                    <li>Compartí el código con tus compradores.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

        </section>

        <section id="artistas" className="scroll-mt-8 rounded-2xl border bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Users className="h-5 w-5" /></div><div><h2 className="text-2xl font-bold">Para artistas y músicos</h2><p className="mt-1 text-muted-foreground">No necesitás usuario para consultar la información de un evento.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><InfoPoint icon={Eye} text="Accedé desde un enlace privado que te comparte el productor." /><InfoPoint icon={BarChart3} text="Consultá vendidas, confirmadas, pendientes y gratuitas." /><InfoPoint icon={Users} text="Si el productor lo habilita, podés ver nombre, email y teléfono." /><InfoPoint icon={ShieldCheck} text="El enlace es de solo lectura: no permite aprobar ni modificar entradas." /></div></div></div>
        </section>

        <section id="compradores" className="scroll-mt-8">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Ticket className="h-5 w-5" /></div><div><h2 className="text-2xl font-bold">Para compradores</h2><p className="text-muted-foreground">Tu compra queda acompañada en cada paso.</p></div></div>
          <div className="grid gap-4 md:grid-cols-3"><GuideCard icon={Ticket} title="Elegí tus entradas" text="Seleccioná cantidad, promociones o modalidades 2x1 cuando estén disponibles." /><GuideCard icon={ClipboardList} title="Revisá antes de pagar" text="Confirmá nombre, email, cantidad, total y medio de pago en la pantalla de revisión." /><GuideCard icon={CheckCircle2} title="Recibí y confirmá" text="Por transferencia, copiá el Alias, enviá el comprobante y esperá la revisión. Por Mercado Pago, el estado se actualiza automáticamente." /></div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <InfoPoint icon={Gift} text="Un código gratis o con descuento permite una sola entrada." />
            <InfoPoint icon={Repeat2} text="Un código 2x1 fija automáticamente dos entradas por el precio de una." />
            <InfoPoint icon={CheckCircle2} text="Si el total es gratis, la entrada se confirma sin transferencia ni pago online." />
          </div>
        </section>

        <section id="soporte" className="scroll-mt-8">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><CircleHelp className="h-5 w-5 text-primary" />Preguntas frecuentes</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><Faq question="¿Puedo usar TekaTeka sin crear una cuenta?" answer="Sí. Podés consultar esta guía y comprar entradas sin usuario. La cuenta es necesaria para administrar eventos." /><Faq question="¿Qué pasa si pago por transferencia?" answer="Vas a ver el Alias y el titular de la cuenta, podés copiar el Alias y luego adjuntar un comprobante. El productor revisará y confirmará el pago." /><Faq question="¿Puedo compartir el acceso con un artista?" answer="Sí. Desde las ventas del evento generá un enlace privado y elegí si puede ver la lista de compradores o solo los totales." /><Faq question="¿Cómo funciona un código 2x1?" answer="Al aplicarlo, la compra queda configurada con 2 entradas y el comprador paga el valor de 1. La cantidad no puede aumentarse ni reducirse mientras el código esté aplicado." /><Faq question="¿Puedo usar un código para varias entradas?" answer="Los códigos gratis y de descuento parcial permiten 1 entrada por compra. Solo el tipo 2x1 permite obtener 2 entradas." /><Faq question="¿Qué hago si escribí mal mi email?" answer="Usá Volver atrás antes de continuar al pago para corregir tus datos. Si ya completaste la compra, contactá al productor del evento." /></CardContent></Card>
        </section>

        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-primary p-6 text-primary-foreground sm:flex-row sm:items-center sm:p-8"><div><h2 className="text-xl font-bold">¿Listo para empezar?</h2><p className="mt-1 text-primary-foreground/80">Creá tu cuenta y publicá tu primer evento.</p></div><Button variant="secondary" asChild><Link href="/auth/sign-up">Empezar ahora <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></section>
      </div>
    </main>
  )
}

function GuideCard({ icon: Icon, title, text }: { icon: typeof Plus; title: string; text: string }) { return <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-3 text-base"><Icon className="h-5 w-5 text-primary" />{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card> }
function InfoPoint({ icon: Icon, text }: { icon: typeof Eye; text: string }) { return <div className="flex gap-3 text-sm leading-6"><Icon className="mt-1 h-4 w-4 shrink-0 text-primary" /><span>{text}</span></div> }
function PromoGuide({ icon: Icon, title, text }: { icon: typeof Gift; title: string; text: string }) { return <div className="rounded-xl border bg-background/70 p-4"><Icon className="h-5 w-5 text-primary" /><h4 className="mt-3 font-semibold">{title}</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div> }
function Faq({ question, answer }: { question: string; answer: string }) { return <div className="border-l-2 border-primary/30 pl-4"><h3 className="font-semibold">{question}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{answer}</p></div> }

