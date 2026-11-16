"use client"

import { useTransition } from "react"
import { updatePlatformFee, clearVenuePlatformFee } from "@/app/actions/platform-fees"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Venue = { id: string; name: string; platform_fee_percent: number | null }

export function PlatformFeeSettings({ globalPercent, startsAt, venues }: { globalPercent: number; startsAt: string | null; venues: Venue[] }) {
  const [isPending, startTransition] = useTransition()
  const save = (formData: FormData, action: typeof updatePlatformFee) => startTransition(() => void action(formData))
  return <section className="mb-8 rounded-lg border border-primary/20 bg-card p-6">
    <div className="mb-5"><h2 className="font-semibold">Comisión TekaTeka</h2><p className="mt-1 text-sm text-muted-foreground">Se aplica al precio final de cada entrada paga. Un espacio puede tener una comisión propia.</p></div>
    <form action={(formData) => save(formData, updatePlatformFee)} className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><div className="space-y-2"><Label htmlFor="global-platform-fee">Comisión global (%)</Label><Input id="global-platform-fee" name="percent" type="number" min="0" max="100" step="0.01" defaultValue={globalPercent} /></div><div className="space-y-2"><Label htmlFor="platform-fee-starts-at">Cobrar desde eventos creados el</Label><Input id="platform-fee-starts-at" name="startsAt" type="date" defaultValue={startsAt || ""} /><p className="text-xs text-muted-foreground">Los eventos creados antes quedan sin recargo.</p></div><Button type="submit" disabled={isPending}>Guardar</Button></form>
    {venues.length > 0 && <div className="mt-6 space-y-3"><p className="text-sm font-medium">Comisión por espacio</p>{venues.map((venue) => <div key={venue.id} className="flex flex-wrap items-end gap-3 rounded-md border p-3"><div className="min-w-48 flex-1"><Label htmlFor={`venue-fee-${venue.id}`}>{venue.name}</Label><Input id={`venue-fee-${venue.id}`} form={`venue-form-${venue.id}`} name="percent" type="number" min="0" max="100" step="0.01" placeholder={`Global (${globalPercent}%)`} defaultValue={venue.platform_fee_percent ?? ""} /></div><form id={`venue-form-${venue.id}`} action={(formData) => { formData.set("venueId", venue.id); save(formData, updatePlatformFee) }}><Button type="submit" variant="outline" disabled={isPending}>Guardar</Button></form><form action={(formData) => { formData.set("venueId", venue.id); startTransition(() => void clearVenuePlatformFee(formData)) }}><Button type="submit" variant="ghost" disabled={isPending}>Usar global</Button></form></div>)}</div>}
  </section>
}
