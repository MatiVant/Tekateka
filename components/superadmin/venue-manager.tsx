"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, Loader2, X } from "lucide-react"
import { reviewVenueProposal, saveVenue } from "@/app/actions/venues"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CatalogVenue, VenueProposal } from "@/lib/venue-proposals"

function VenueFields({ prefix, venue, requireAddress = false }: { prefix: string; venue?: Partial<CatalogVenue>; requireAddress?: boolean }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-name`}>Nombre{venue && venue.active === false && !requireAddress ? " (inactivo)" : ""}</Label>
        <Input id={`${prefix}-name`} name="name" required minLength={2} maxLength={120} defaultValue={venue?.name ?? ""} placeholder="La Lengua del Juglar" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-address`}>Dirección</Label>
        <Input id={`${prefix}-address`} name="address" required={requireAddress} maxLength={200} defaultValue={venue?.address ?? ""} placeholder="Calle 123, Ciudad" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-maps`}>Link de Google Maps (opcional)</Label>
        <Input id={`${prefix}-maps`} name="location_url" type="url" maxLength={500} defaultValue={venue?.location_url ?? ""} placeholder="https://maps.app.goo.gl/..." />
      </div>
    </>
  )
}

function VenueForm({ venue, onSaved }: { venue?: CatalogVenue; onSaved?: () => void }) {
  const [isPending, startTransition] = useTransition()
  const prefix = venue ? `venue-${venue.id}` : "venue-new"

  const submit = (formData: FormData) => {
    if (venue) formData.set("id", venue.id)
    startTransition(async () => {
      const result = await saveVenue(formData)
      if (result.ok) {
        toast.success(venue ? "Espacio actualizado" : "Espacio creado")
        onSaved?.()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form action={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1.4fr_1fr_auto] md:items-end">
      <VenueFields prefix={prefix} venue={venue} />
      <Button type="submit" variant={venue ? "outline" : "default"} disabled={isPending}>
        {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        {venue ? "Guardar" : "Crear espacio"}
      </Button>
    </form>
  )
}

function ProposalForm({ proposal }: { proposal: VenueProposal }) {
  const [isPending, startTransition] = useTransition()
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null)

  const submit = (formData: FormData) => {
    const chosen = (formData.get("decision") as "approve" | "reject" | null) ?? decision
    if (!chosen) return
    formData.set("id", proposal.id)
    formData.set("decision", chosen)
    if (chosen === "reject" && !window.confirm(`¿Rechazar "${proposal.name}"?`)) return
    startTransition(async () => {
      const result = await reviewVenueProposal(formData)
      if (result.ok) toast.success(chosen === "approve" ? "Espacio aprobado: ya aparece en la lista" : "Propuesta rechazada")
      else toast.error(result.error)
    })
  }

  const proposedAt = proposal.created_at ? new Date(proposal.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }) : null

  return (
    <form action={submit} className="space-y-3 rounded-md border border-amber-300 bg-amber-50/60 p-3 dark:bg-amber-950/20">
      <p className="text-xs text-muted-foreground">
        Propuesto por <strong className="text-foreground">{proposal.proposer?.name || "un organizador"}</strong>
        {proposal.proposer?.email ? ` (${proposal.proposer.email})` : ""}
        {proposedAt ? ` · ${proposedAt}` : ""}
      </p>
      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_1fr] md:items-end">
        <VenueFields prefix={`proposal-${proposal.id}`} venue={proposal} requireAddress />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approve" onClick={() => setDecision("approve")} disabled={isPending} className="gap-1.5">
          {isPending && decision === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Aproba
        </Button>
        <Button type="submit" name="decision" value="reject" variant="outline" formNoValidate onClick={() => setDecision("reject")} disabled={isPending} className="gap-1.5">
          {isPending && decision === "reject" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          Rechaza
        </Button>
      </div>
    </form>
  )
}

export function VenueManager({ venues, proposals = [], proposalsEnabled = true }: { venues: CatalogVenue[]; proposals?: VenueProposal[]; proposalsEnabled?: boolean }) {
  const [formKey, setFormKey] = useState(0)
  const withoutAddress = venues.filter((venue) => !venue.address).length
  return (
    <div className="space-y-4">
      {!proposalsEnabled && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Para recibir propuestas de espacios de los organizadores, corré la migración <code>scripts/047_venue_proposals.sql</code> en Supabase.
        </p>
      )}
      {proposals.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Propuestas pendientes ({proposals.length})</p>
          {proposals.map((proposal) => <ProposalForm key={proposal.id} proposal={proposal} />)}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        La dirección de cada espacio aparece escrita en los mails de entradas y en la página del evento.
        {withoutAddress > 0 && <> <strong className="text-foreground">{withoutAddress} {withoutAddress === 1 ? "espacio no tiene" : "espacios no tienen"} dirección cargada.</strong></>}
      </p>
      <div className="space-y-3">
        {venues.map((venue) => <VenueForm key={venue.id} venue={venue} />)}
      </div>
      <div className="space-y-2 pt-2">
        <p className="text-sm font-medium">Nuevo espacio</p>
        <VenueForm key={formKey} onSaved={() => setFormKey((key) => key + 1)} />
      </div>
    </div>
  )
}
