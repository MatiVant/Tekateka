"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function ResumePaymentButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  async function resume() {
    setLoading(true)
    setError(null)
    const response = await fetch("/api/mercadopago/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
    const result = await response.json()
    if (!response.ok) { setError(result.error || "No se pudo iniciar el pago"); setLoading(false); return }
    window.location.href = result.initPoint
  }
  useEffect(() => {
    if (!started.current) {
      started.current = true
      void resume()
    }
  }, [])
  return <div className="mt-6"><Button onClick={resume} disabled={loading}>{loading ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Preparando pago...</> : "Continuar con Mercado Pago"}</Button>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</div>
}
