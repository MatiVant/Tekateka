import type { LucideIcon } from "lucide-react"
import { ChevronDown } from "lucide-react"

type SuperAdminModuleCardProps = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  children: React.ReactNode
}

export function SuperAdminModuleCard({ id, title, description, icon: Icon, children }: SuperAdminModuleCardProps) {
  return (
    <details id={id} className="group scroll-mt-24 overflow-hidden rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="rounded-lg bg-muted p-2.5 text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t p-4 sm:p-6">{children}</div>
    </details>
  )
}
