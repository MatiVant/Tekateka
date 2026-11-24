"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

// Barra de progreso fina arriba de todo para que se note que una página está
// cargando. Arranca al hacer click en un link interno y termina cuando cambia
// la ruta (pathname o query).
export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const trickleRef = useRef<number | null>(null)
  const safetyRef = useRef<number | null>(null)
  const hideRef = useRef<number | null>(null)
  const activeRef = useRef(false)

  const clearTimers = () => {
    if (trickleRef.current) window.clearInterval(trickleRef.current)
    if (safetyRef.current) window.clearTimeout(safetyRef.current)
    if (hideRef.current) window.clearTimeout(hideRef.current)
    trickleRef.current = null
    safetyRef.current = null
    hideRef.current = null
  }

  const finish = () => {
    if (!activeRef.current) return
    activeRef.current = false
    clearTimers()
    setProgress(100)
    hideRef.current = window.setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 250)
  }

  useEffect(() => {
    const start = () => {
      clearTimers()
      activeRef.current = true
      setVisible(true)
      setProgress(12)
      trickleRef.current = window.setInterval(() => {
        setProgress((value) => (value < 90 ? value + (90 - value) * 0.12 : value))
      }, 200)
      // Por si la navegación se cancela o falla: nunca dejamos la barra colgada.
      safetyRef.current = window.setTimeout(finish, 15000)
    }

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.("a")
      if (!anchor || !anchor.href) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download") || anchor.getAttribute("aria-disabled") === "true") return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      const current = window.location
      if (url.pathname === current.pathname && url.search === current.search) return
      start()
    }

    document.addEventListener("click", handleClick, true)
    return () => {
      document.removeEventListener("click", handleClick, true)
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--primary)]"
        style={{ width: `${progress}%`, transition: "width 200ms ease-out" }}
      />
    </div>
  )
}
