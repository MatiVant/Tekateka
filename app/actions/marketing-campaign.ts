"use server"

import { Resend } from "resend"
import { requireAuth } from "@/lib/auth"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { createUnsubscribeToken } from "@/lib/marketing"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character)
}

export async function sendMarketingCampaign(formData: { subject: string; body: string }) {
  const { authorized } = await requireAuth(["superadmin"])
  if (!authorized) return { error: "No autorizado" }
  if (!resend) return { error: "El servicio de email no está configurado" }

  const subject = formData.subject.trim()
  const body = formData.body.trim()
  if (!subject || !body) return { error: "El asunto y el mensaje son obligatorios" }
  if (subject.length > 150) return { error: "El asunto es demasiado largo" }
  if (body.length > 10000) return { error: "El mensaje es demasiado largo" }

  const admin = createAdminClient()
  const [{ data: tickets, error: ticketsError }, { data: unsubscribes, error: unsubscribesError }] = await Promise.all([
    admin.from("tickets").select("buyer_email").eq("marketing_consent", true).neq("status", "cancelled"),
    admin.from("marketing_unsubscribes").select("email"),
  ])
  if (ticketsError || unsubscribesError) return { error: "No se pudo obtener la audiencia" }

  const blocked = new Set((unsubscribes ?? []).map((row) => row.email.trim().toLowerCase()))
  const recipients = [...new Set((tickets ?? []).map((ticket) => ticket.buyer_email.trim().toLowerCase()))]
    .filter((email) => email && !blocked.has(email))
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tktk.buholabs.com.ar").replace(/\/$/, "")
  let sent = 0

  for (const email of recipients) {
    const unsubscribeUrl = `${siteUrl}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${createUnsubscribeToken(email)}`
    const result = await resend.emails.send({
      from: "TekaTeka <notificaciones@tktk.buholabs.com.ar>",
      to: email,
      subject,
      html: `<main style="max-width:620px;margin:auto;font-family:Arial,sans-serif;line-height:1.6;color:#171717"><div style="white-space:pre-wrap">${escapeHtml(body)}</div><hr style="margin:32px 0;border:0;border-top:1px solid #ddd"><p style="font-size:12px;color:#666">Recibís este email porque aceptaste recibir novedades y promociones de TekaTeka al comprar una entrada. <a href="${unsubscribeUrl}">Desuscribirme de emails promocionales</a>.</p></main>`,
    })
    if (!result.error) sent += 1
  }

  return { success: true, sent, skipped: recipients.length - sent }
}
