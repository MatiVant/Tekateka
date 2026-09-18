'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check, X, Calendar, AlertCircle } from 'lucide-react'
import { acceptOwnershipTransfer, rejectOwnershipTransfer } from '@/app/actions/event-ownership-transfer'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Transfer {
  id: string
  events: {
    id: string
    title: string
    event_date: string
  } | null
  proposed_owner_email: string
  created_at: string
}

interface PendingOwnershipTransfersProps {
  transfers: Transfer[]
}

export function PendingOwnershipTransfers({ transfers }: PendingOwnershipTransfersProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  if (!transfers.length) {
    return null
  }

  const handleAccept = (transferId: string, eventTitle: string) => {
    startTransition(async () => {
      try {
        await acceptOwnershipTransfer(transferId)
        setSuccess(`Ahora eres el dueño de "${eventTitle}"`)
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al aceptar')
        setSuccess('')
      }
    })
  }

  const handleReject = (transferId: string) => {
    startTransition(async () => {
      try {
        await rejectOwnershipTransfer(transferId)
        setSuccess('Solicitud rechazada')
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al rechazar')
        setSuccess('')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="border-l-4 border-primary/50 bg-primary/5 px-4 py-3 rounded">
        <p className="text-sm font-medium">
          Tienes {transfers.length} solicitud{transfers.length !== 1 ? 'es' : ''} de transferencia pendiente{transfers.length !== 1 ? 's' : ''}
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

      <div className="space-y-3">
        {transfers.map((transfer) => (
          <Card key={transfer.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">
                    {transfer.events?.title || 'Evento no encontrado'}
                  </h4>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Transferencia ofrecida por:</span> el dueño actual del evento
                    </p>
                    {transfer.events?.event_date && (
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(transfer.events.event_date).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                    <p className="text-xs">
                      Solicitud: {new Date(transfer.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => handleAccept(transfer.id, transfer.events?.title || 'Evento')}
                  disabled={isPending}
                  className="flex-1 gap-2"
                >
                  <Check className="h-4 w-4" />
                  Aceptar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(transfer.id)}
                  disabled={isPending}
                  className="flex-1 gap-2"
                >
                  <X className="h-4 w-4" />
                  Rechazar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
