"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, XCircle, Edit, ExternalLink, KeyRound } from "lucide-react"
import Link from "next/link"
import { slugify } from "@/lib/slugify"
import { useRouter } from "next/navigation"
import { handleNetworkError } from "@/lib/network-error-handler"
import { useToast } from "@/hooks/use-toast"

type Organizer = {
  id: string
  email: string
  full_name: string
  organization_name: string | null
  organizer_status: string
  subscription_status: string
  events_created_count: number
  subscription_expires_at: string | null
  rejection_reason: string | null
  created_at: string
}

export function OrganizerManagement({ organizers }: { organizers: Organizer[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedOrganizer, setSelectedOrganizer] = useState<Organizer | null>(null)
  const [action, setAction] = useState<"approve" | "reject" | "subscription" | "password" | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [subscriptionStatus, setSubscriptionStatus] = useState<"free" | "active" | "inactive">("free")
  const [expirationDate, setExpirationDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")

  const filteredOrganizers = organizers.filter((o) => {
    if (filter === "all") return true
    return o.organizer_status === filter
  })

  const handleApprove = async () => {
    if (!selectedOrganizer) return
    setIsLoading(true)

    try {
      const response = await fetch("/api/superadmin/manage-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: selectedOrganizer.id,
          action: "approve",
        }),
      }).catch((err) => {
        handleNetworkError(err)
        throw err
      })

      if (!response.ok) throw new Error("Error al aprobar")

      router.refresh()
      setAction(null)
      setSelectedOrganizer(null)
    } catch (error) {
      console.error(error)
      if (!(error instanceof TypeError)) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al aprobar el organizador",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedOrganizer || !rejectionReason) return
    setIsLoading(true)

    try {
      const response = await fetch("/api/superadmin/manage-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: selectedOrganizer.id,
          action: "reject",
          rejectionReason,
        }),
      }).catch((err) => {
        handleNetworkError(err)
        throw err
      })

      if (!response.ok) throw new Error("Error al rechazar")

      router.refresh()
      setAction(null)
      setSelectedOrganizer(null)
      setRejectionReason("")
    } catch (error) {
      console.error(error)
      if (!(error instanceof TypeError)) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al rechazar el organizador",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordReset = async (organizer: Organizer) => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/superadmin/manage-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: organizer.id, action: "password-reset" }),
      }).catch((error) => {
        handleNetworkError(error)
        throw error
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || "No se pudo enviar el enlace de recuperación")

      toast({
        title: "Enlace enviado",
        description: `Se envió un correo para restablecer la contraseña de ${organizer.email}.`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo enviar el enlace",
        description: error instanceof Error ? error.message : "Intentá nuevamente.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetPassword = async () => {
    if (!selectedOrganizer || newPassword.length < 12 || newPassword.length > 128 || newPassword !== confirmPassword) return
    setIsLoading(true)

    try {
      const response = await fetch("/api/superadmin/manage-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: selectedOrganizer.id,
          action: "password-set",
          newPassword,
        }),
      }).catch((error) => {
        handleNetworkError(error)
        throw error
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || "No se pudo cambiar la contraseña")

      toast({
        title: "Contraseña actualizada",
        description: `La contraseña de ${selectedOrganizer.email} se cambió. Compartila por un canal seguro.`,
      })
      setNewPassword("")
      setConfirmPassword("")
      setAction(null)
      setSelectedOrganizer(null)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo cambiar la contraseña",
        description: error instanceof Error ? error.message : "Intentá nuevamente.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubscription = async () => {
    if (!selectedOrganizer) return
    setIsLoading(true)

    try {
      const response = await fetch("/api/superadmin/manage-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: selectedOrganizer.id,
          action: "subscription",
          subscriptionStatus,
          expirationDate: expirationDate || null,
        }),
      }).catch((err) => {
        handleNetworkError(err)
        throw err
      })

      if (!response.ok) throw new Error("Error al actualizar suscripción")

      router.refresh()
      setAction(null)
      setSelectedOrganizer(null)
      setExpirationDate("")
    } catch (error) {
      console.error(error)
      if (!(error instanceof TypeError)) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al actualizar la suscripción",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2">
        <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          Todos ({organizers.length})
        </Button>
        <Button variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>
          Pendientes ({organizers.filter((o) => o.organizer_status === "pending").length})
        </Button>
        <Button variant={filter === "approved" ? "default" : "outline"} onClick={() => setFilter("approved")}>
          Aprobados ({organizers.filter((o) => o.organizer_status === "approved").length})
        </Button>
        <Button variant={filter === "rejected" ? "default" : "outline"} onClick={() => setFilter("rejected")}>
          Rechazados ({organizers.filter((o) => o.organizer_status === "rejected").length})
        </Button>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Espacio y organizador</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Suscripción</TableHead>
              <TableHead>Eventos</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrganizers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay organizadores para mostrar
                </TableCell>
              </TableRow>
            ) : (
              filteredOrganizers.map((organizer) => (
                <TableRow key={organizer.id}>
                  <TableCell>
                    <div className="font-medium">{organizer.organization_name || organizer.full_name}</div>
                    {organizer.organization_name && organizer.organization_name.trim().toLocaleLowerCase() !== organizer.full_name.trim().toLocaleLowerCase() && (
                      <div className="mt-1 text-xs text-muted-foreground">Organizador: {organizer.full_name.trim()}</div>
                    )}
                  </TableCell>
                  <TableCell>{organizer.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        organizer.organizer_status === "approved"
                          ? "default"
                          : organizer.organizer_status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {organizer.organizer_status === "pending" && "Pendiente"}
                      {organizer.organizer_status === "approved" && "Aprobado"}
                      {organizer.organizer_status === "rejected" && "Rechazado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        organizer.subscription_status === "active"
                          ? "default"
                          : organizer.subscription_status === "inactive"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {organizer.subscription_status === "free" && "Gratis"}
                      {organizer.subscription_status === "active" && "Activa"}
                      {organizer.subscription_status === "inactive" && "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell>{organizer.events_created_count}</TableCell>
                  <TableCell>{new Date(organizer.created_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {(organizer.organization_name || organizer.full_name) && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/${slugify(organizer.organization_name || organizer.full_name)}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1 h-4 w-4" />
                            Ver sitio
                          </Link>
                        </Button>
                      )}
                      {organizer.organizer_status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setSelectedOrganizer(organizer)
                              setAction("approve")
                            }}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedOrganizer(organizer)
                              setAction("reject")
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {organizer.email && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handlePasswordReset(organizer)}
                            disabled={isLoading}
                            aria-label={`Enviar enlace para restablecer la contraseña de ${organizer.email}`}
                          >
                            <KeyRound className="mr-1 h-4 w-4" />
                            Enviar reset
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedOrganizer(organizer)
                              setNewPassword("")
                              setConfirmPassword("")
                              setAction("password")
                            }}
                            disabled={isLoading}
                            aria-label={`Definir manualmente la contraseña de ${organizer.email}`}
                          >
                            Definir contraseña
                          </Button>
                        </>
                      )}
                      {organizer.organizer_status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedOrganizer(organizer)
                            setSubscriptionStatus(organizer.subscription_status === "active" || organizer.subscription_status === "inactive" ? organizer.subscription_status : "free")
                            setAction("subscription")
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Suscripción
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={action === "password"}
        onOpenChange={(open) => {
          if (!open && !isLoading) {
            setAction(null)
            setNewPassword("")
            setConfirmPassword("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir contraseña manualmente</DialogTitle>
            <DialogDescription>
              Establecé una contraseña para {selectedOrganizer?.email}. No se enviará ningún correo. Compartila con el organizador por un canal seguro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizer-new-password">Nueva contraseña</Label>
              <Input
                id="organizer-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={12}
                maxLength={128}
                required
              />
              <p className="text-xs text-muted-foreground">Usá al menos 12 caracteres.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizer-confirm-password">Confirmar contraseña</Label>
              <Input
                id="organizer-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={12}
                maxLength={128}
                required
              />
            </div>
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-sm text-destructive" role="alert">Las contraseñas no coinciden.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAction(null)
                setNewPassword("")
                setConfirmPassword("")
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSetPassword}
              disabled={isLoading || newPassword.length < 12 || newPassword.length > 128 || newPassword !== confirmPassword}
            >
              {isLoading ? "Actualizando..." : "Cambiar contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de aprobación */}
      <Dialog open={action === "approve"} onOpenChange={() => setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Organizador</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de aprobar a {selectedOrganizer?.full_name}?
              <br />
              El organizador podrá crear 1 evento gratis y recibirá un email de confirmación.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={isLoading}>
              {isLoading ? "Aprobando..." : "Aprobar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de rechazo */}
      <Dialog open={action === "reject"} onOpenChange={() => setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Organizador</DialogTitle>
            <DialogDescription>
              Explica el motivo del rechazo. El organizador recibirá un email con esta información.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Motivo del rechazo *</Label>
              <Textarea
                id="reason"
                placeholder="Ej: No cumple con los requisitos establecidos..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isLoading || !rejectionReason}>
              {isLoading ? "Rechazando..." : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de suscripción */}
      <Dialog open={action === "subscription"} onOpenChange={() => setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar Suscripción</DialogTitle>
            <DialogDescription>Actualiza el estado de suscripción de {selectedOrganizer?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subscription">Estado de Suscripción</Label>
              <Select value={subscriptionStatus} onValueChange={(value) => {
                if (value === "free" || value === "active" || value === "inactive") setSubscriptionStatus(value)
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Gratis (1 evento)</SelectItem>
                  <SelectItem value="active">Activa (ilimitado)</SelectItem>
                  <SelectItem value="inactive">Inactiva (sin acceso)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {subscriptionStatus === "active" && (
              <div>
                <Label htmlFor="expiration">Fecha de Expiración (opcional)</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>
            )}
            <div className="p-4 bg-muted rounded-lg text-sm">
              <p className="font-semibold mb-1">Eventos creados: {selectedOrganizer?.events_created_count}</p>
              <p className="text-muted-foreground">
                {subscriptionStatus === "free" && "Puede crear 1 evento gratis"}
                {subscriptionStatus === "active" && "Puede crear eventos ilimitados"}
                {subscriptionStatus === "inactive" && "No puede crear eventos"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSubscription} disabled={isLoading}>
              {isLoading ? "Actualizando..." : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
