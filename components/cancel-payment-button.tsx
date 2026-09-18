"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function CancelPaymentButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  async function cancel() {
    if (!window.confirm("¿Querés avisar que no vas a comprar esta entrada?")) return
    setLoading(true)
    const response = await fetch("/api/cancel-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
    setLoading(false)
    if (response.ok) setDone(true)
  }
  if (done) return <p className="mt-6 rounded-md bg-muted p-3 text-sm">Listo, avisamos que no vas a comprar. La reserva fue liberada.</p>
  return <Button variant="ghost" className="mt-4 w-full text-muted-foreground" onClick={cancel} disabled={loading}>{loading ? "Enviando aviso..." : "No voy a comprar esta entrada"}</Button>
}
