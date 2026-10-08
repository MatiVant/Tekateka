"use client"

import { useState } from "react"
import Link from "next/link"
import { createArtistShareLink } from "@/app/actions/artist-share-links"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Copy, ExternalLink, Loader2, Music2, TicketCheck } from "lucide-react"

interface EventCreatedShareCardProps {
  eventId: string
  eventTitle: string
  onBackToPanel: () => void
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Fall back to the legacy copy API for browsers that deny clipboard access.
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

export function EventCreatedShareCard({ eventId, eventTitle, onBackToPanel }: EventCreatedShareCardProps) {
  const publicUrl = `${typeof window === "undefined" ? "" : window.location.origin}/events/${eventId}`
  const [artistUrl, setArtistUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [copiedLink, setCopiedLink] = useState<"public" | "artist" | null>(null)
  const [error, setError] = useState("")


  async function handleCopy(url: string, kind: "public" | "artist") {
    try {
      await copyText(url)
      setCopiedLink(kind)
      setError("")
      window.setTimeout(() => setCopiedLink(null), 2200)
    } catch {
      setError("No se pudo copiar automáticamente. Seleccioná y copiá el enlace manualmente.")
    }
  }

  async function handleCreateArtistLink() {
    setBusy(true)
    setError("")
    try {
      const { token } = await createArtistShareLink(eventId)
      setArtistUrl(`${window.location.origin}/share/${token}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el enlace para músicos.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-primary/25 shadow-lg shadow-primary/5">
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>¡Tu evento ya está creado!</CardTitle>
        <CardDescription>
          {eventTitle}. Compartí la entrada con el público o generá un acceso privado para músicos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <TicketCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">Link público para compartir</h3>
              <p className="mt-1 text-sm text-muted-foreground">Para asistentes, redes y cualquier persona externa.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Enlace público del evento"
                  readOnly
                  value={publicUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button type="button" variant="outline" onClick={() => handleCopy(publicUrl, "public")}>
                  {copiedLink === "public" ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                  {copiedLink === "public" ? "Copiado" : "Copiar link"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={`/events/${eventId}`} target="_blank" rel="noreferrer">
                    <ExternalLink data-icon="inline-start" />
                    Ver evento
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Music2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">Acceso privado para músicos</h3>
              <p className="mt-1 text-sm text-muted-foreground">Un informe de solo lectura, sin necesidad de crearles una cuenta.</p>
              {!artistUrl ? (
                <Button type="button" variant="outline" className="mt-3" onClick={handleCreateArtistLink} disabled={busy}>
                  {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Music2 data-icon="inline-start" />}
                  {busy ? "Generando enlace..." : "Generar link para músicos"}
                </Button>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="Enlace privado para músicos"
                    readOnly
                    value={artistUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <Button type="button" variant="outline" onClick={() => handleCopy(artistUrl, "artist")}>
                    {copiedLink === "artist" ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                    {copiedLink === "artist" ? "Copiado" : "Copiar link"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end border-t pt-4">
          <Button type="button" onClick={onBackToPanel}>Ir al panel de eventos</Button>
        </div>
      </CardContent>
    </Card>
  )
}
