"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createCheckerLink } from "@/app/actions/checker-links"
import { Copy, Loader2, Mail, MessageCircle } from "lucide-react"

export function CheckerLinkButton() {
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const handleCreate = async () => {
    setLoading(true)
    try {
      const created = await createCheckerLink()
      setLink(`${window.location.origin}${new URL(created, window.location.origin).pathname}`)
      await navigator.clipboard?.writeText(`${window.location.origin}${new URL(created, window.location.origin).pathname}`)
    } finally { setLoading(false) }
  }
  return <div className="rounded-lg border border-primary/20 bg-card p-4"><p className="font-medium">Control de acceso</p><p className="mt-1 text-sm text-muted-foreground">Generá un link temporal para que otra persona valide entradas sin entrar al admin.</p><Button className="mt-3 gap-2" onClick={handleCreate} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}{link ? "Link copiado" : "Generar link de acceso"}</Button>{link && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="text-green-600" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Lector de entradas: ${link}`)}`, "_blank")}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button><Button size="sm" variant="outline" onClick={() => window.open(`mailto:?subject=${encodeURIComponent("Link lector de entradas")}&body=${encodeURIComponent(`Abrí este link para validar entradas: ${link}`)}`, "_blank")}><Mail className="mr-2 h-4 w-4" />Email</Button></div>}</div>
}
