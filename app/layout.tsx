import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Navbar } from "@/components/navbar"
import { getCurrentUser } from "@/lib/auth"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const _bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" })

export const metadata: Metadata = {
  title: "TekaTeka - Venta de Entradas",
  description: "Plataforma de gestión y venta de entradas para eventos y espectáculos",
  generator: "v0.app",
  icons: {
    icon: "/tekateka-isologo.png",
    apple: "/tekateka-isologo.png",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const userData = await getCurrentUser()

  return (
    <html lang="es" className="dark">
      <body className={`${_geist.variable} ${_geistMono.variable} ${_bricolage.variable} font-sans antialiased bg-background text-foreground`}>
        <Navbar user={userData?.user} profile={userData?.profile} />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
