"use client"

import { useLinkStatus } from "next/link"
import { Loader2 } from "lucide-react"

// Spinner chiquito que aparece dentro de un <Link> mientras carga su destino.
export function LinkPendingIndicator() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <Loader2 className="ml-1 size-3.5 shrink-0 animate-spin" aria-label="Cargando" />
}
