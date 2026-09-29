"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronDown, CircleHelp, LogOut, Menu, Moon, Sun, UserRound, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import { slugify } from "@/lib/slugify"

interface NavbarProps {
  user?: { email?: string } | null
  profile?: { role: string; full_name: string | null; organization_name?: string | null } | null
}

export function Navbar({ user: initialUser, profile: initialProfile }: NavbarProps) {
  const router = useRouter()
  const [user, setUser] = useState(initialUser)
  const [profile, setProfile] = useState(initialProfile)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const latestUserIdRef = useRef<string | null>(null)
  const authEventReceivedRef = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    let authEventVersion = 0

    const loadProfile = async (userId: string) => {
      const { data: nextProfile } = await supabase
        .from("profiles")
        .select("role, full_name, organization_name")
        .eq("id", userId)
        .maybeSingle()
      if (mounted && latestUserIdRef.current === userId) setProfile(nextProfile)
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      authEventVersion += 1
      authEventReceivedRef.current = true

      const nextUser = session?.user
      const nextUserId = nextUser?.id ?? null
      const previousUserId = latestUserIdRef.current
      latestUserIdRef.current = nextUserId
      setUser(nextUser ? { email: nextUser.email } : null)

      if (!nextUser) {
        setProfile(null)
      } else {
        const authenticatedUserId = nextUser.id
        if (previousUserId !== authenticatedUserId) setProfile(null)
        window.setTimeout(() => {
          if (mounted && latestUserIdRef.current === authenticatedUserId) void loadProfile(authenticatedUserId)
        }, 0)
      }

      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        router.refresh()
      }
    })

    const initialAuthEventVersion = authEventVersion
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted || authEventVersion !== initialAuthEventVersion) return

      const nextUser = session?.user
      const nextUserId = nextUser?.id ?? null
      latestUserIdRef.current = nextUserId
      setUser(nextUser ? { email: nextUser.email } : null)
      if (!nextUser) {
        setProfile(null)
        return
      }

      await loadProfile(nextUser.id)
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    if (authEventReceivedRef.current) return
    setUser(initialUser)
    setProfile(initialProfile)
  }, [initialUser, initialProfile])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    const supabase = createClient()
    setUser(null)
    setProfile(null)
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("[v0] Error al cerrar sesión:", error)
      // Si la sesión local no pudo invalidarse, no dejamos la interfaz en un estado ambiguo.
      setUser(initialUser)
      setProfile(initialProfile)
      setIsLoggingOut(false)
      return
    }

    // Navegación completa: fuerza a Next.js a consultar la sesión/cookies nuevas
    // y evita que quede visible el dashboard del árbol RSC anterior.
    window.location.assign("/")
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-[#e7dcc8] bg-[#f4eddf]/95 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-[4.25rem] items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="TekaTeka, volver al inicio">
            <Image src="/tekateka-logo.png" alt="TekaTeka — Tus eventos. Tus entradas." width={220} height={74} priority className="hidden h-11 w-auto object-contain sm:block" />
            <Image src="/tekateka-mark.png" alt="TekaTeka" width={48} height={48} priority className="h-10 w-10 object-contain sm:hidden" />
          </Link>

          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <Button variant="ghost" className="hidden rounded-full sm:inline-flex" asChild><Link href="/eventos">Eventos</Link></Button>
            {!user && <Button variant="ghost" className="hidden rounded-full sm:inline-flex" asChild><Link href="/ayuda">Ayuda</Link></Button>}
            {user ? (
              <>
                <div className="hidden items-center gap-1 sm:flex">
                  {(profile?.role === "organizer" || profile?.role === "superadmin") && <Button variant="ghost" asChild><Link href="/admin">Panel Admin</Link></Button>}
                  {(profile?.role === "organizer" || profile?.role === "superadmin" || profile?.role === "admin") && (profile.organization_name || profile.full_name) && <Button variant="ghost" asChild><Link href={`/${slugify(profile.organization_name || profile.full_name || "")}`}>Mi página</Link></Button>}
                  {profile?.role === "superadmin" && <Button variant="ghost" asChild><Link href="/superadmin">Superadmin</Link></Button>}
                  {profile?.role === "ticketero" && <Button variant="ghost" asChild><Link href="/verify">Verificar Tickets</Link></Button>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="max-w-52 gap-2 rounded-full px-3" aria-label="Abrir menú de usuario">
                        <UserRound className="size-4 shrink-0" />
                        <span className="max-w-36 truncate">{profile?.full_name || user.email || "Mi cuenta"}</span>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuLabel className="truncate">{profile?.full_name || user.email || "Mi cuenta"}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile"><UserRound />Mi perfil</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/ayuda"><CircleHelp />Ayuda</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                        {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                        {resolvedTheme === "dark" ? "Modo claro" : "Modo oscuro"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut} aria-busy={isLoggingOut}>
                    <LogOut className="mr-2 h-4 w-4" />{isLoggingOut ? "Saliendo..." : "Salir"}
                  </Button>
                </div>
                <Button variant="outline" size="icon" className="rounded-full border-[#d8c9b4] sm:hidden" onClick={() => setIsMenuOpen((open) => !open)} aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={isMenuOpen}>
                  {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </>
            ) : (
              <>
                <div className="hidden items-center gap-1 sm:flex">
                  <Button variant="ghost" className="rounded-full px-2 text-xs sm:px-4 sm:text-sm" asChild><Link href="/auth/login">Iniciar sesión</Link></Button>
                  <Button className="rounded-full px-3 text-xs sm:px-4 sm:text-sm" asChild><Link href="/auth/sign-up">Registrarse</Link></Button>
                </div>
                <Button variant="outline" size="icon" className="rounded-full border-[#d8c9b4] sm:hidden" onClick={() => setIsMenuOpen((open) => !open)} aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={isMenuOpen}>
                  {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </>
            )}
          </div>
        </div>
        {isMenuOpen && <div className="flex flex-col gap-2 border-t border-[#e7dcc8] py-3 sm:hidden">
          <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href="/eventos" onClick={() => setIsMenuOpen(false)}>Eventos disponibles</Link></Button>
          <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href="/ayuda" onClick={() => setIsMenuOpen(false)}><CircleHelp className="mr-2 size-4" />Ayuda</Link></Button>
          {user ? <>
            <Button variant="ghost" className="justify-start rounded-xl" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
              {resolvedTheme === "dark" ? "Modo claro" : "Modo oscuro"}
            </Button>
            {(profile?.role === "organizer" || profile?.role === "superadmin") && <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href="/admin" onClick={() => setIsMenuOpen(false)}>Panel Admin</Link></Button>}
            {(profile?.role === "organizer" || profile?.role === "superadmin" || profile?.role === "admin") && (profile.organization_name || profile.full_name) && <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href={`/${slugify(profile.organization_name || profile.full_name || "")}`} onClick={() => setIsMenuOpen(false)}>Mi página pública</Link></Button>}
            {profile?.role === "superadmin" && <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href="/superadmin" onClick={() => setIsMenuOpen(false)}>Superadmin</Link></Button>}
            {profile?.role === "ticketero" && <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href="/verify" onClick={() => setIsMenuOpen(false)}>Verificar tickets</Link></Button>}
            <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href="/profile" onClick={() => setIsMenuOpen(false)}>Mi perfil</Link></Button>
            <Button variant="outline" className="justify-start rounded-xl" onClick={handleLogout} disabled={isLoggingOut}><LogOut className="mr-2 h-4 w-4" />Salir</Button>
          </> : <>
            <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href="/auth/login" onClick={() => setIsMenuOpen(false)}>Iniciar sesión</Link></Button>
            <Button className="rounded-xl" asChild><Link href="/auth/sign-up" onClick={() => setIsMenuOpen(false)}>Registrarse</Link></Button>
          </>}
        </div>}
      </div>
    </nav>
  )
}
