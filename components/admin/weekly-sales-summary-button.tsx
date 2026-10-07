"use client"

import { useState, useTransition } from "react"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { sendWeeklySalesSummary } from "@/app/actions/send-weekly-sales-summary"

export function WeeklySalesSummaryButton() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)

  const handleSend = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await sendWeeklySalesSummary()
      setMessage(result.message)
      setHasError(!result.success)
    })
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="outline" onClick={handleSend} disabled={isPending}>
        <Mail aria-hidden="true" className="mr-2 h-4 w-4" />
        {isPending ? "Enviando resumen..." : "Enviar resumen de los últimos 7 días"}
      </Button>
      <p className="text-xs text-muted-foreground">Envío manual al correo de tu cuenta de organizador.</p>
      {message && (
        <p role="status" aria-live="polite" className={`text-sm ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </p>
      )}
    </div>
  )
}
