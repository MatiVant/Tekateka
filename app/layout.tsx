import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Navbar } from "@/components/navbar"
import { ThemeProvider } from "@/components/theme-provider"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { NavigationProgress } from "@/components/navigation-progress"
import { AuthFeedbackToast } from "@/components/auth-feedback"
import { getCurrentUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const _outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tekateka.com.ar"),
  title: "TekaTeka — Tus eventos. Tus entradas.",
  description: "Descubrí eventos, comprá entradas y compartí tus encuentros con TekaTeka.",
  generator: "v0.app",
  icons: {
    icon: [{ url: "/tekateka-mark.png", type: "image/png" }],
    shortcut: ["/tekateka-mark.png"],
    apple: [{ url: "/tekateka-mark.png", type: "image/png" }],
  },
  openGraph: {
    title: "TekaTeka — Tus eventos. Tus entradas.",
    description: "Más cultura. Más encuentros.",
    images: [{ url: "/tekateka-logo.png", width: 2048, height: 768, alt: "TekaTeka — Tus eventos. Tus entradas." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TekaTeka — Tus eventos. Tus entradas.",
    description: "Más cultura. Más encuentros.",
    images: ["/tekateka-logo.png"],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const userData = await getCurrentUser()
  let pendingTicketCount = 0

  if (userData?.user && (userData.profile?.role === "organizer" || userData.profile?.role === "superadmin")) {
    const supabase = await createClient()
    const { data: pendingTickets } = await supabase
      .from("tickets")
      .select("status, payment_status, events!inner(organizer_id)")
      .eq("events.organizer_id", userData.user.id)
    pendingTicketCount = (pendingTickets ?? []).filter(
      (ticket) => ticket.status !== "cancelled" && ticket.status !== "confirmed" && ticket.status !== "used" && ticket.payment_status !== "approved",
    ).length
  }

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${_geist.variable} ${_geistMono.variable} ${_outfit.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <Suspense fallback={null}><NavigationProgress /></Suspense>
          <Navbar user={userData?.user} profile={userData?.profile} pendingTicketCount={pendingTicketCount} />
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors closeButton />
          <AuthFeedbackToast />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
