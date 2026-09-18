"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import { ThemeToggle } from "@/components/theme-toggle"

interface NavbarProps {
  user?: { email?: string } | null
  profile?: { role: string; full_name: string | null } | null
}

export function Navbar({ user: initialUser, profile: initialProfile }: NavbarProps) {
  const router = useRouter()
  const [user, setUser] = useState(initialUser)
  const [profile, setProfile] = useState(initialProfile)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
    <nav className="sticky top-0 z-50 border-b border-foreground/10 bg-background/90 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/tekateka-isologo.png" alt="TekaTeka" width={32} height={32} className="h-8 w-auto" />
            <span className="text-xl font-black tracking-[-0.06em] text-foreground">Teka<span className="text-primary">Teka</span><span className="ml-2 hidden text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground md:inline">Más cultura</span></span>
          </Link>

          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <Button variant="ghost" className="hidden sm:inline-flex" asChild><Link href="/ayuda">Ayuda</Link></Button>
            {user && <span className="hidden max-w-32 truncate text-xs text-muted-foreground lg:block">{profile?.full_name || user.email}</span>}
            {user && <ThemeToggle />}
            {user ? (
              <>
                {(profile?.role === "organizer" || profile?.role === "superadmin") && <Button variant="ghost" asChild><Link href="/admin">Panel Admin</Link></Button>}
                {profile?.role === "superadmin" && <Button variant="ghost" asChild><Link href="/superadmin">Superadmin</Link></Button>}
                {profile?.role === "ticketero" && <Button variant="ghost" asChild><Link href="/verify">Verificar Tickets</Link></Button>}
                <Button variant="ghost" asChild><Link href="/profile">Mi Perfil</Link></Button>
                <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut} aria-busy={isLoggingOut}>
                  <LogOut className="mr-2 h-4 w-4" />{isLoggingOut ? "Saliendo..." : "Salir"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="px-2 text-xs sm:px-4 sm:text-sm" asChild><Link href="/auth/login">Iniciar Sesión</Link></Button>
                <Button className="px-3 text-xs sm:px-4 sm:text-sm" asChild><Link href="/auth/sign-up">Registrarse</Link></Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
