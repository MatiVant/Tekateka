"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function LiveEventSearch({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    const query = value.trim().toLocaleLowerCase("es-AR")
    const cards = document.querySelectorAll<HTMLElement>("[data-event-card]")
    cards.forEach((card) => {
      const searchable = card.dataset.eventSearch || ""
      card.hidden = query.length >= 3 && !searchable.includes(query)
    })
  }, [value])

  return (
    <div className="w-full max-w-md">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Buscar evento o lugar…"
          aria-label="Buscar evento o lugar"
          className="pl-9"
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Escribí al menos 3 letras para filtrar.</p>
    </div>
  )
}
