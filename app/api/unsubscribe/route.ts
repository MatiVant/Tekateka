import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { createUnsubscribeToken } from "@/lib/marketing"

function validToken(email: string, token: string) {
  const expected = createUnsubscribeToken(email)
  const expectedBuffer = Buffer.from(expected)
  const tokenBuffer = Buffer.from(token)
  return expectedBuffer.length === tokenBuffer.length && timingSafeEqual(expectedBuffer, tokenBuffer)
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() || ""
  const token = request.nextUrl.searchParams.get("token") || ""
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  if (!validEmail || !validToken(email, token)) {
    return new NextResponse("Enlace de desuscripción inválido.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } })
  }

  const admin = createAdminClient()
  const { error } = await admin.from("marketing_unsubscribes").upsert({ email, unsubscribed_at: new Date().toISOString() })
  if (error) return new NextResponse("No pudimos procesar la desuscripción. Intentá nuevamente.", { status: 500 })

  return new NextResponse(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Desuscripción confirmada</title></head><body style="font-family:Arial,sans-serif;max-width:620px;margin:60px auto;padding:20px"><h1>Desuscripción confirmada</h1><p>Ya no recibirás emails promocionales de TekaTeka en <strong>${email}</strong>.</p></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } })
}
