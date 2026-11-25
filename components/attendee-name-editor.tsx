"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Pencil, UserRound } from "lucide-react"
import { updateAttendeeName } from "@/app/actions/attendee-name"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ATTENDEE_NAME_MAX } from "@/lib/attendee-name"

export function AttendeeNameEditor({
  ticketId,
  buyerName,
  attendeeName,
  editable,
  disabledReason = null,
}: {
  ticketId: string
  buyerName: string
  attendeeName: string | null
  editable: boolean
  disabledReason?: string | null
}) {
  const [saved, setSaved] = useState(attendeeName)
  const [value, setValue] = useState(attendeeName ?? "")
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputId = `attendee-${ticketId}`

  const save = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateAttendeeName(ticketId, value)
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      setSaved(result.attendeeName)
      setValue(result.attendeeName ?? "")
      setEditing(false)
      toast.success(result.attendeeName ? `Entrada a nombre de ${result.attendeeName}` : `Listo, la entrada vuelve a salir a nombre de ${buyerName}`)
    })
  }

  const cancel = () => {
    setValue(saved ?? "")
    setError(null)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <Label htmlFor={inputId} className="text-sm">Nombre de quien va a usar esta entrada</Label>
        <Input
          id={inputId}
          value={value}
          maxLength={ATTENDEE_NAME_MAX}
          autoFocus
          placeholder="Nombre y apellido"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); save() }
            if (event.key === "Escape") cancel()
          }}
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">Si lo dejás vacío, la entrada sale a nombre de {buyerName}.</p>
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={save} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cancel} disabled={isPending}>Cancelar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 break-words">
          {saved ? <>A nombre de: <strong>{saved}</strong></> : <span className="text-muted-foreground">A nombre de {buyerName}</span>}
        </span>
      </div>
      {editable && (
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          {saved ? "Editar nombre" : "Asignar nombre"}
        </Button>
      )}
    </div>
      {!editable && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  )
}
