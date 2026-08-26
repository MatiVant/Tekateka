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

  useEffect(() => {
    const supabase = createClient()
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ? { email: session.user.email } : null)
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        router.refresh()
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    setUser(initialUser)
    setProfile(initialProfile)
  }, [initialUser, initialProfile])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/tekateka-isologo.png" alt="TekaTeka" width={32} height={32} className="h-8 w-auto" />
            <span className="text-xl font-bold text-primary">TekaTeka</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {user && <span className="hidden max-w-32 truncate text-xs text-muted-foreground lg:block">{profile?.full_name || user.email}</span>}
            {user && <ThemeToggle />}
            {user ? (
              <>
                {(profile?.role === "organizer" || profile?.role === "superadmin") && <Button variant="ghost" asChild><Link href="/admin">Panel Admin</Link></Button>}
                {profile?.role === "superadmin" && <Button variant="ghost" asChild><Link href="/superadmin">Superadmin</Link></Button>}
                {profile?.role === "ticketero" && <Button variant="ghost" asChild><Link href="/verify">Verificar Tickets</Link></Button>}
                <Button variant="ghost" asChild><Link href="/profile">Mi Perfil</Link></Button>
                <Button variant="outline" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Salir</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild><Link href="/auth/login">Iniciar Sesión</Link></Button>
                <Button asChild><Link href="/auth/sign-up">Registrarse</Link></Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
