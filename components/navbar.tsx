"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, Menu, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import { ThemeToggle } from "@/components/theme-toggle"
import { slugify } from "@/lib/slugify"

interface NavbarProps {
  user?: { email?: string } | null
  profile?: { role: string; full_name: string | null } | null
}

export function Navbar({ user: initialUser, profile: initialProfile }: NavbarProps) {
  const router = useRouter()
  const [user, setUser] = useState(initialUser)
  const [profile, setProfile] = useState(initialProfile)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setUser(session?.user ? { email: session.user.email } : null)
      if (!session?.user) {
        setProfile(null)
        return
      }
      const { data: nextProfile } = await supabase.from("profiles").select("role, full_name").eq("id", session.user.id).maybeSingle()
      if (mounted) setProfile(nextProfile)
    }

    void syncSession()
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setUser(session?.user ? { email: session.user.email } : null)
      if (!session?.user) {
        setProfile(null)
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void syncSession()
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        router.refresh()
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
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
            <Button variant="ghost" className="hidden rounded-full sm:inline-flex" asChild><Link href="/ayuda">Ayuda</Link></Button>
            <Button variant="ghost" className="hidden rounded-full sm:inline-flex" asChild><Link href="/eventos">Eventos</Link></Button>
            {user && <span className="hidden max-w-32 truncate text-xs text-muted-foreground lg:block">{profile?.full_name || user.email}</span>}
            {user && <ThemeToggle />}
            {user ? (
              <>
                <div className="hidden items-center gap-1 sm:flex">
                  {(profile?.role === "organizer" || profile?.role === "superadmin") && <Button variant="ghost" asChild><Link href="/admin">Panel Admin</Link></Button>}
                  {(profile?.role === "organizer" || profile?.role === "superadmin" || profile?.role === "admin") && profile.full_name && <Button variant="ghost" asChild><Link href={`/${slugify(profile.full_name)}`}>Mi página</Link></Button>}
                  {profile?.role === "superadmin" && <Button variant="ghost" asChild><Link href="/superadmin">Superadmin</Link></Button>}
                  {profile?.role === "ticketero" && <Button variant="ghost" asChild><Link href="/verify">Verificar Tickets</Link></Button>}
                  <Button variant="ghost" asChild><Link href="/profile">Mi Perfil</Link></Button>
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
          {user ? <>
            {(profile?.role === "organizer" || profile?.role === "superadmin") && <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href="/admin" onClick={() => setIsMenuOpen(false)}>Panel Admin</Link></Button>}
            {(profile?.role === "organizer" || profile?.role === "superadmin" || profile?.role === "admin") && profile.full_name && <Button variant="ghost" className="justify-start rounded-xl" asChild><Link href={`/${slugify(profile.full_name)}`} onClick={() => setIsMenuOpen(false)}>Mi página pública</Link></Button>}
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
