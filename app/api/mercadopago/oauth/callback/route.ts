import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const cookieStore = await cookies()
  const saved = cookieStore.get("mp_oauth_state")?.value
  cookieStore.delete("mp_oauth_state")
  if (!code || !state || !saved || saved.split(":")[1] !== state) return NextResponse.redirect(new URL("/admin?mp_error=state", request.url))

  const producerId = saved.split(":")[0]
  const redirectUri = `${url.origin}/api/mercadopago/oauth/callback`
  const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.MERCADOPAGO_CLIENT_ID, client_secret: process.env.MERCADOPAGO_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  })
  if (!tokenResponse.ok) return NextResponse.redirect(new URL("/admin?mp_error=authorization", request.url))
  const token = await tokenResponse.json()
  const supabase = await createClient()
  const { error } = await supabase.from("mercadopago_connections").upsert({ producer_id: producerId, mp_user_id: String(token.user_id), access_token: token.access_token, refresh_token: token.refresh_token ?? null, expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "producer_id" })
  if (error) return NextResponse.redirect(new URL("/admin?mp_error=storage", request.url))
  return NextResponse.redirect(new URL("/admin?mp_connected=true", request.url))
}
