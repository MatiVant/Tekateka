"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import { proposeVenue } from "@/app/actions/venues"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export const VENUE_APPROVAL_NOTICE = "Tu espacio quedó sujeto a aprobación de Tekateka. Te avisamos cuando esté disponible."

// Botón "Nuevo Espacio" para organizadores: propone un espacio que el
// superadmin tiene que aprobar. No usa <form> porque vive dentro del
// formulario del evento (los formularios anidados mandarían el evento).
export function VenueProposalDialog({ onProposed }: { onProposed?: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [locationUrl, setLocationUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    setError(null)
    if (name.trim().length < 2) return setError("Escribí el nombre del espacio")
    if (address.trim().length < 5) return setError("Escribí la dirección del espacio (calle, número y ciudad)")
    const formData = new FormData()
    formData.set("name", name)
    formData.set("address", address)
    formData.set("location_url", locationUrl)
    startTransition(async () => {
      const result = await proposeVenue(formData)
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success(VENUE_APPROVAL_NOTICE, { duration: 8000 })
      onProposed?.(name.trim())
      setName("")
      setAddress("")
      setLocationUrl("")
      setOpen(false)
    })
  }

  const onEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      submit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isPending) setOpen(next) }}>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo Espacio
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Espacio</DialogTitle>
          <DialogDescription>El espacio queda sujeto a aprobación de Tekateka. Cuando esté aprobado vas a poder elegirlo en tus eventos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="proposal-name">Nombre *</Label>
            <Input id="proposal-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="La Lengua del Juglar" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proposal-address">Dirección *</Label>
            <Input id="proposal-address" maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={onEnter} placeholder="Calle 123, Ciudad" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proposal-maps">Link de Google Maps (opcional)</Label>
            <Input id="proposal-maps" type="url" maxLength={500} value={locationUrl} onChange={(e) => setLocationUrl(e.target.value)} onKeyDown={onEnter} placeholder="https://maps.app.goo.gl/..." />
          </div>
          {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
          <Button type="button" onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Enviar a aprobación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
