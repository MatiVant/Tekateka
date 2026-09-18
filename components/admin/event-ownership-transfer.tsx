'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { AlertCircle, Send, X } from 'lucide-react'
import { requestOwnershipTransfer, cancelOwnershipTransfer } from '@/app/actions/event-ownership-transfer'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EventOwnershipTransferProps {
  eventId: string
  currentTransfer?: {
    id: string
    proposed_owner_email: string
    created_at: string
  } | null
}

export function EventOwnershipTransfer({ eventId, currentTransfer }: EventOwnershipTransferProps) {
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  const handleRequestTransfer = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError('Por favor ingresa un email')
      return
    }

    startTransition(async () => {
      try {
        await requestOwnershipTransfer(eventId, email.trim())
        setSuccess('Solicitud de transferencia enviada')
        setEmail('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al solicitar transferencia')
      }
    })
  }

  const handleCancelTransfer = () => {
    if (!currentTransfer) return

    startTransition(async () => {
      try {
        await cancelOwnershipTransfer(currentTransfer.id)
        setSuccess('Solicitud cancelada')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cancelar')
      }
    })
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Transferir Ownership</h3>
          <p className="text-sm text-muted-foreground">
            Solicita a otro usuario que asuma la gestión de este evento. Deberá aceptar la solicitud para que se complete la transferencia.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500/50 bg-green-500/5">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        {currentTransfer ? (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Solicitud pendiente enviada a:</p>
              <p className="font-medium">{currentTransfer.proposed_owner_email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Enviada: {new Date(currentTransfer.created_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelTransfer}
              disabled={isPending}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar Solicitud
            </Button>
          </div>
        ) : (
          <form onSubmit={handleRequestTransfer} className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Email del nuevo dueño"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
              <Button
                type="submit"
                disabled={isPending}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Solicitar
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  )
}
