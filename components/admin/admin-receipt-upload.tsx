"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { FileUp, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function AdminReceiptUpload({ ticketId }: { ticketId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function upload(file: File) {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("ticketId", ticketId)
      formData.append("file", file)
      const response = await fetch("/api/admin/upload-receipt", { method: "POST", body: formData })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el comprobante")
      toast({ title: "Comprobante cargado", description: "La entrada quedó pendiente de revisión." })
      window.location.reload()
    } catch (error) {
      toast({ title: "No se pudo cargar", description: error instanceof Error ? error.message : "Intentá nuevamente.", variant: "destructive" })
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return <>
    <input ref={inputRef} type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
    <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading} title="Cargar comprobante">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
      Cargar comprobante
    </Button>
  </>
}
