import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Navbar } from "@/components/navbar"
import { ThemeProvider } from "@/components/theme-provider"
import { getCurrentUser } from "@/lib/auth"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const _outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" })

export const metadata: Metadata = {
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

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${_geist.variable} ${_geistMono.variable} ${_outfit.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <Navbar user={userData?.user} profile={userData?.profile} />
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
