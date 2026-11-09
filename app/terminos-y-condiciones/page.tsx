import Link from "next/link"
import { ticketTerms } from "@/lib/legal"

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <article className="mx-auto max-w-2xl rounded-lg border bg-background p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-bold">Términos y condiciones de compra</h1>
        <p className="mt-3 text-sm text-muted-foreground">Última actualización: 9 de noviembre de 2026</p>
        <p className="mt-6">Al comprar una entrada en TekaTeka, aceptás las siguientes condiciones:</p>
        <ol className="mt-4 list-decimal space-y-4 pl-6">
          {ticketTerms.map((term) => <li key={term}>{term}</li>)}
        </ol>
        <p className="mt-8 text-sm text-muted-foreground">Si tenés dudas, podés escribirnos a consultas@tekateka.com.ar.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary underline">Volver al inicio</Link>
      </article>
    </main>
  )
}
