import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { requireAuth } from "@/lib/auth"

export async function GET(request: Request) {
  const { authorized, user } = await requireAuth(["organizer", "superadmin"])
  if (!authorized || !user) return NextResponse.redirect(new URL("/auth/login", request.url))

  const state = randomBytes(32).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set("mp_oauth_state", `${user.id}:${state}`, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" })

  const redirectUri = `${new URL(request.url).origin}/api/mercadopago/oauth/callback`
  const url = new URL("https://auth.mercadopago.com/authorization")
  url.searchParams.set("client_id", process.env.MERCADOPAGO_CLIENT_ID!)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("platform_id", "mp")
  url.searchParams.set("state", state)
  url.searchParams.set("redirect_uri", redirectUri)
  return NextResponse.redirect(url)
}
