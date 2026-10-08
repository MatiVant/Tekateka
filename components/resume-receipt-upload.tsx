"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { compressReceipt, isPdf } from "@/lib/compress-image"

export function ResumeReceiptUpload({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!file) return
    setLoading(true)
    setMessage(null)
    try {
      const uploadFile = isPdf(file) ? file : await compressReceipt(file)
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("token", token)
      formData.append("notes", notes)
      const response = await fetch("/api/upload-receipt", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo enviar el comprobante")
      setMessage("Comprobante enviado. El organizador revisará tu transferencia.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar el comprobante")
    } finally {
      setLoading(false)
    }
  }

  return <form onSubmit={submit} className="mt-6 space-y-3 rounded-lg border bg-muted/30 p-4"><div><p className="font-semibold">Enviar comprobante</p><p className="text-sm text-muted-foreground">Subí una imagen o PDF de la transferencia.</p></div><Input type="file" accept="image/*,.pdf" required onChange={(event) => setFile(event.target.files?.[0] || null)} /><Input placeholder="Nota opcional" value={notes} onChange={(event) => setNotes(event.target.value)} /><Button type="submit" disabled={!file || loading}>{loading ? "Enviando..." : "Enviar comprobante"}</Button>{message && <p className="text-sm" role="status">{message}</p>}</form>
}
