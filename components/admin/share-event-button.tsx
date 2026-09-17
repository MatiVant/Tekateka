"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2, Check, Copy } from "lucide-react"

export function ShareEventButton({ eventId, eventTitle, eventSlug }: { eventId: string; eventTitle: string; eventSlug?: string | null }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = `${window.location.origin}/events/${eventSlug || eventId}`
    if (navigator.share) {
      await navigator.share({ title: eventTitle, text: `Mirá este evento: ${eventTitle}`, url })
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return <Button type="button" variant="outline" size="sm" onClick={share} aria-label={`Compartir ${eventTitle}`}><Share2 className="mr-1 h-3 w-3" />{copied ? <><Check className="mr-1 h-3 w-3" />Copiado</> : <><Copy className="mr-1 h-3 w-3" />Compartir</>}</Button>
}
