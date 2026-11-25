import type { ReactNode } from "react"
import { EventSectionNav } from "@/components/admin/event-section-nav"
import { getManagedEvent } from "@/lib/admin-event"

export default async function EventAdminLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { event } = await getManagedEvent(id)

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <EventSectionNav event={event} />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
