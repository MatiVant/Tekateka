"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LinkPendingIndicator } from "@/components/link-pending-indicator"
import { formatArgentinaDateTime } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { ManagedEvent } from "@/lib/admin-event"

export function EventSectionNav({ event }: { event: Pick<ManagedEvent, "id" | "title" | "event_date" | "slug"> }) {
  const pathname = usePathname()
  const base = `/admin/events/${event.id}`
  const items = [
    { id: "edit", href: `${base}/edit`, label: "Evento" },
    { id: "tickets", href: `${base}/tickets`, label: "Entradas" },
    { id: "settings", href: `${base}/settings`, label: "Tipos y códigos" },
    { id: "links", href: `${base}/tickets/links`, label: "Colaboradores" },
    { id: "verify", href: `/verify?event=${encodeURIComponent(event.id)}`, label: "Lector QR" },
  ] as const

  const activeId = pathname.includes("/tickets/links")
    ? "links"
    : pathname.includes("/tickets")
      ? "tickets"
      : pathname.includes("/settings")
        ? "settings"
        : pathname.includes("/edit")
          ? "edit"
          : pathname.startsWith("/verify")
            ? "verify"
            : null

  return (
    <header className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a mis eventos
          <LinkPendingIndicator />
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatArgentinaDateTime(event.event_date)}</p>
        </div>
        <Button variant="outline" size="sm" className="w-fit shrink-0" asChild>
          <Link href={`/events/${event.slug || event.id}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Ver página pública
            <LinkPendingIndicator />
          </Link>
        </Button>
      </div>

      <nav aria-label="Secciones del evento" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-1 rounded-xl border bg-card p-1">
          {items.map((item) => {
            const active = activeId === item.id
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
                <LinkPendingIndicator />
              </Link>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
