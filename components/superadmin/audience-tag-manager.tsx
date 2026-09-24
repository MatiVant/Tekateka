"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createAudienceTag, toggleAudienceTag, updateAudienceTag } from "@/app/actions/audience-tags"

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
      {tags.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Todavía no hay etiquetas creadas.</p> : <div className="space-y-2">{tags.map((tag) => editingId === tag.id ? <div key={tag.id} className="flex gap-2"><Input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveTag(tag); if (event.key === "Escape") setEditingId(null) }} /><Button type="button" onClick={() => saveTag(tag)} disabled={isPending}>Guardar</Button><Button type="button" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button></div> : <div key={tag.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"><button type="button" onClick={() => changeTag(tag)} className={`rounded-full border px-3 py-1 text-sm ${tag.active ? "border-primary bg-primary text-primary-foreground" : "border-muted text-muted-foreground line-through"}`} aria-pressed={tag.active}>{tag.name}</button><Button type="button" variant="ghost" size="sm" onClick={() => { setEditingId(tag.id); setEditingName(tag.name) }}>Editar</Button></div>)}</div>}
    </section>
  )
}
