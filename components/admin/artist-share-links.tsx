"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createArtistShareLink, revokeArtistShareLink, updateArtistShareLinkPermissions } from "@/app/actions/artist-share-links"
import { Copy, Link2, Trash2 } from "lucide-react"

type LinkItem = { id: string; label: string; created_at: string; expires_at: string | null; revoked_at: string | null; last_accessed_at: string | null; permissions?: { buyers?: boolean } | null }

export function ArtistShareLinks({ eventId, initialLinks }: { eventId: string; initialLinks: LinkItem[] }) {
  const [links, setLinks] = useState(initialLinks)
  const [busy, setBusy] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [allowBuyers, setAllowBuyers] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement("textarea")
      input.value = url
      input.style.position = "fixed"
      input.style.opacity = "0"
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      input.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function createLink() {
    setBusy(true)
    try {
      const { token, linkId } = await createArtistShareLink(eventId, { buyers: allowBuyers })
      setCreatedUrl(`${window.location.origin}/share/${token}`)
      if (linkId) setLinks((current) => [{ id: linkId, label: "Acceso artista", created_at: new Date().toISOString(), expires_at: null, revoked_at: null, last_accessed_at: null, permissions: { buyers: allowBuyers } }, ...current])
    } finally { setBusy(false) }
  }

  async function toggleBuyers(link: LinkItem) {
    const buyers = !Boolean(link.permissions?.buyers)
    setBusy(true)
    try {
      await updateArtistShareLinkPermissions(link.id, eventId, buyers)
      setLinks((current) => current.map((item) => item.id === link.id ? { ...item, permissions: { ...(item.permissions ?? {}), buyers } } : item))
    } finally { setBusy(false) }
  }

  async function revoke(id: string) {
    setBusy(true)
    try { await revokeArtistShareLink(id, eventId); setLinks((current) => current.filter((link) => link.id !== id)) }
    finally { setBusy(false) }
  }

  return <Card className="mb-6">
    <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Acceso para músicos</CardTitle><CardDescription>Compartí un informe de solo lectura sin crearles un usuario.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowBuyers} onChange={(event) => setAllowBuyers(event.target.checked)} /> Permitir ver quién compró (nombre y email)</label><Button onClick={createLink} disabled={busy}><Link2 className="mr-2 h-4 w-4" />Generar enlace privado</Button>
      {createdUrl && <div className="flex flex-col gap-2 rounded-lg border p-3"><span className="text-sm font-medium">Enlace generado</span><div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={createdUrl} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded border bg-background px-3 py-2 text-sm" /><Button type="button" variant="outline" onClick={() => copyLink(createdUrl)}><Copy className="mr-2 h-4 w-4" />{copied ? "Copiado" : "Copiar enlace"}</Button></div><p className="text-xs text-muted-foreground">Si el botón no copia automáticamente, también podés seleccionar el enlace y copiarlo manualmente.</p></div>}
      {links.map((link) => <div key={link.id} className="flex items-center justify-between gap-3 border-t pt-3 text-sm"><div><div className="font-medium">{link.label}</div><div className="text-muted-foreground">Creado {new Date(link.created_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}{link.revoked_at ? " · Revocado" : link.last_accessed_at ? " · Usado" : " · Sin usar"}</div>{!link.revoked_at && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(link.permissions?.buyers)} onChange={() => toggleBuyers(link)} disabled={busy} /> Puede ver compradores</label>}</div>{!link.revoked_at && <Button variant="ghost" size="sm" onClick={() => revoke(link.id)} disabled={busy}><Trash2 className="mr-2 h-4 w-4" />Revocar</Button>}</div>)}
    </CardContent>
  </Card>
}
