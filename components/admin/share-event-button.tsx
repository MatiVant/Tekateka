"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2, Check, Copy } from "lucide-react"

type ShareEventButtonProps = {
  eventId: string
  eventTitle: string
  eventSlug?: string | null
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Continue with the legacy copy method for browsers that deny clipboard access.
    }
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)
  const copied = document.execCommand("copy")
  document.body.removeChild(textarea)

  if (!copied) throw new Error("No se pudo copiar el enlace")
}

export function ShareEventButton({ eventId, eventTitle, eventSlug }: ShareEventButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle")

  const copyLink = async () => {
    const url = `${window.location.origin}/events/${eventSlug || eventId}`

    try {
      await copyToClipboard(url)
      setStatus("copied")
      window.setTimeout(() => setStatus("idle"), 2000)
    } catch {
      setStatus("error")
      window.prompt("No se pudo copiar automáticamente. Copiá el enlace:", url)
      window.setTimeout(() => setStatus("idle"), 3000)
    }
  }

  const label = status === "copied" ? "Copiado" : status === "error" ? "Copiá el link manualmente" : "Copiar link"

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={copyLink}
      aria-label={`${label} de ${eventTitle}`}
      aria-live="polite"
    >
      {status === "copied" ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
      {label}
      {status === "idle" && <Share2 className="ml-1 h-3 w-3" />}
    </Button>
  )
}
