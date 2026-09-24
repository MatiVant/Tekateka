"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createAudienceTag, deleteAudienceTag, toggleAudienceTag, updateAudienceTag } from "@/app/actions/audience-tags"
import { Check, Pencil, Trash2, X } from "lucide-react"

type Tag = { id: string; name: string; active: boolean }

export function AudienceTagManager({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState(initialTags)
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isPending, startTransition] = useTransition()

  const addTag = () => {
    const value = name.trim()
    if (!value) return
    startTransition(async () => {
      await createAudienceTag(value)
      setTags((current) => [...current, { id: crypto.randomUUID(), name: value, active: true }].sort((a, b) => a.name.localeCompare(b.name)))
      setName("")
    })
  }

  const saveTag = (tag: Tag) => {
    const value = editingName.trim()
    if (!value) return
    startTransition(async () => {
      await updateAudienceTag(tag.id, value)
      setTags((current) => current.map((item) => item.id === tag.id ? { ...item, name: value } : item).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingId(null)
    })
  }

  const changeTag = (tag: Tag) => startTransition(async () => {
    await toggleAudienceTag(tag.id, !tag.active)
    setTags((current) => current.map((item) => item.id === tag.id ? { ...item, active: !item.active } : item))
  })

  const removeTag = (tag: Tag) => {
    if (!window.confirm(`¿Eliminar la etiqueta “${tag.name}”?`)) return
    startTransition(async () => {
      await deleteAudienceTag(tag.id)
      setTags((current) => current.filter((item) => item.id !== tag.id))
    })
  }

  return (
    <section className="mb-10 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Etiquetas de audiencia</h2>
        <p className="text-sm text-muted-foreground">Estas etiquetas quedan disponibles para todos los eventos.</p>
      </div>
      <div className="mb-5 flex gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag() } }} placeholder="Nueva etiqueta, por ejemplo Teatro" maxLength={40} />
        <Button type="button" onClick={addTag} disabled={isPending || !name.trim()}>Agregar</Button>
      </div>
      {tags.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Todavía no hay etiquetas creadas.</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{tags.map((tag) => editingId === tag.id ? <div key={tag.id} className="col-span-2 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2 sm:col-span-3 lg:col-span-4 xl:col-span-5"><Input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveTag(tag); if (event.key === "Escape") setEditingId(null) }} /><Button type="button" size="icon" onClick={() => saveTag(tag)} disabled={isPending} aria-label="Guardar"><Check className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => setEditingId(null)} aria-label="Cancelar"><X className="h-4 w-4" /></Button></div> : <div key={tag.id} className={`group flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors ${tag.active ? "border-border bg-background" : "border-border/60 bg-muted/40 opacity-70"}`}><button type="button" onClick={() => changeTag(tag)} className={`truncate text-left text-sm font-medium ${tag.active ? "text-foreground" : "text-muted-foreground line-through"}`} aria-pressed={tag.active}>{tag.name}</button><div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingId(tag.id); setEditingName(tag.name) }} aria-label={`Editar ${tag.name}`}><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeTag(tag)} disabled={isPending} aria-label={`Eliminar ${tag.name}`}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>)}</div>}
    </section>
  )
}
