import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export function PageLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <div className="mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="size-4 animate-spin text-primary" />
        {label}
      </div>
      <Skeleton className="mb-3 h-9 w-64 max-w-full" />
      <Skeleton className="mb-8 h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72 rounded-xl" />
    </main>
  )
}
