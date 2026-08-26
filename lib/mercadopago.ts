import { createClient } from "@/lib/supabase/admin"

export async function getProducerAccessToken(producerId: string) {
  const supabase = createClient()
  const { data: connection } = await supabase.from("mercadopago_connections").select("access_token, refresh_token, expires_at").eq("producer_id", producerId).maybeSingle()
  if (!connection) return null
  if (!connection.expires_at || new Date(connection.expires_at).getTime() > Date.now() + 60_000) return connection.access_token
  if (!connection.refresh_token) return null
  const response = await fetch("https://api.mercadopago.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: process.env.MERCADOPAGO_CLIENT_ID, client_secret: process.env.MERCADOPAGO_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: connection.refresh_token }) })
  if (!response.ok) return null
  const token = await response.json()
  await supabase.from("mercadopago_connections").update({ access_token: token.access_token, refresh_token: token.refresh_token ?? connection.refresh_token, expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null, updated_at: new Date().toISOString() }).eq("producer_id", producerId)
  return token.access_token as string
}
