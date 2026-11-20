"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createCheckerLink } from "@/app/actions/checker-links"
import { Copy, Loader2, Mail, MessageCircle } from "lucide-react"

export function CheckerLinkButton({ eventId }: { eventId: string }) {
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleCreate = async () => {
    setError(null)
    setLoading(true)
    try {
      const created = await createCheckerLink(eventId)
      setLink(`${window.location.origin}${new URL(created, window.location.origin).pathname}`)
      try {
        await navigator.clipboard?.writeText(`${window.location.origin}${new URL(created, window.location.origin).pathname}`)
      } catch {
        setError("El link se generó, pero no se pudo copiar automáticamente.")
      }
    } catch {
      setError("No se pudo generar el link de acceso. Intentá nuevamente.")
    } finally { setLoading(false) }
  }
  return <div className="flex min-h-16 w-full flex-col items-stretch justify-center gap-2 rounded-xl border border-[#d8c9b4] bg-background px-3 py-2">
    <Button variant="outline" size="lg" className="h-11 w-full gap-2 rounded-lg border-0 bg-transparent px-2 shadow-none hover:bg-muted/50" onClick={handleCreate} disabled={loading}>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Copy className="h-5 w-5" />}
      <span>{link ? "Link copiado" : "Generar acceso"}</span>
    </Button>
    {error && <p role="alert" className="px-2 text-xs text-destructive">{error}</p>}
    {link && <div className="flex justify-center gap-2 border-t border-[#e7dcc8] pt-2">
      <Button size="sm" variant="ghost" className="text-green-600" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Lector de entradas: ${link}`)}`, "_blank")}><MessageCircle className="mr-1.5 h-4 w-4" />WhatsApp</Button>
      <Button size="sm" variant="ghost" onClick={() => window.open(`mailto:?subject=${encodeURIComponent("Link lector de entradas")}&body=${encodeURIComponent(`Abrí este link para validar entradas: ${link}`)}`, "_blank")}><Mail className="mr-1.5 h-4 w-4" />Email</Button>
    </div>}
  </div>
}
