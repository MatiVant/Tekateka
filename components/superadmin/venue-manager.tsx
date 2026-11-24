"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { saveVenue } from "@/app/actions/venues"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Venue = { id: string; name: string; address: string | null; location_url: string | null; active: boolean | null }

function VenueForm({ venue, onSaved }: { venue?: Venue; onSaved?: () => void }) {
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
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-name`}>Nombre{venue && venue.active === false ? " (inactivo)" : ""}</Label>
        <Input id={`${prefix}-name`} name="name" required minLength={2} maxLength={120} defaultValue={venue?.name ?? ""} placeholder="La Lengua del Juglar" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-address`}>Dirección</Label>
        <Input id={`${prefix}-address`} name="address" maxLength={200} defaultValue={venue?.address ?? ""} placeholder="Calle 123, Ciudad" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-maps`}>Link de Google Maps (opcional)</Label>
        <Input id={`${prefix}-maps`} name="location_url" type="url" maxLength={500} defaultValue={venue?.location_url ?? ""} placeholder="https://maps.app.goo.gl/..." />
      </div>
      <Button type="submit" variant={venue ? "outline" : "default"} disabled={isPending}>
        {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        {venue ? "Guardar" : "Crear espacio"}
      </Button>
    </form>
  )
}

export function VenueManager({ venues }: { venues: Venue[] }) {
  const [formKey, setFormKey] = useState(0)
  const withoutAddress = venues.filter((venue) => !venue.address).length
  return (
    <div className="space-y-4">
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
