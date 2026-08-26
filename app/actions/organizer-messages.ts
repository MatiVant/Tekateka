"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

type Priority = "low" | "normal" | "high"

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
}

export async function sendOrganizerMessage(formData: {
  subject: string
  body: string
  priority: Priority
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "No autenticado" }
  }

  const subject = formData.subject.trim()
  const body = formData.body.trim()
  const priority: Priority = ["low", "normal", "high"].includes(formData.priority) ? formData.priority : "normal"

  if (!subject || !body) {
    return { error: "El asunto y el mensaje son obligatorios" }
  }
  if (subject.length > 150) {
    return { error: "El asunto es demasiado largo" }
  }
  if (body.length > 4000) {
    return { error: "El mensaje es demasiado largo" }
  }

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("role, full_name, phone")
    .eq("id", user.id)
    .single()

  const isOrganizer = senderProfile?.role === "organizer" || senderProfile?.role === "superadmin"
  if (!isOrganizer) {
    return { error: "Solo los organizadores pueden enviar mensajes" }
  }

  const { error: insertError } = await supabase.from("organizer_messages").insert({
    organizer_id: user.id,
    subject,
    body,
    priority,
  })

  if (insertError) {
    console.log("[v0] sendOrganizerMessage - insert error:", insertError.message)
    return { error: "No se pudo enviar el mensaje" }
  }

  // Alerta por email al superadmin (best-effort: no bloquea el guardado)
  try {
    const admin = createAdminClient()
    const { data: superadmins } = await admin.from("profiles").select("email").eq("role", "superadmin")
    const recipients = (superadmins ?? []).map((s) => s.email).filter((e): e is string => Boolean(e))

    if (resend && recipients.length > 0) {
      const canSend = !process.env.RESEND_API_KEY?.startsWith("re_") || recipients.includes("mtrovant@gmail.com")
      if (canSend) {
        await resend.emails.send({
          from: "TekaTeka <onboarding@resend.dev>",
          to: recipients,
          replyTo: user.email ?? undefined,
          subject: `[${PRIORITY_LABELS[priority]}] Mensaje de organizador: ${subject}`,
          html: `
            <div style="font-family: sans-serif; line-height: 1.6; color: #1a2b3b;">
              <h2 style="margin-bottom: 4px;">Nuevo mensaje de un organizador</h2>
              <p style="margin: 0 0 16px; color: #5a6b7b;">Prioridad: <strong>${PRIORITY_LABELS[priority]}</strong></p>
              <table style="border-collapse: collapse; margin-bottom: 16px;">
                <tr><td style="padding: 2px 12px 2px 0; color: #5a6b7b;">Organizador</td><td><strong>${senderProfile?.full_name || "Sin nombre"}</strong></td></tr>
                <tr><td style="padding: 2px 12px 2px 0; color: #5a6b7b;">Email</td><td>${user.email ?? "-"}</td></tr>
                <tr><td style="padding: 2px 12px 2px 0; color: #5a6b7b;">Teléfono</td><td>${senderProfile?.phone || "-"}</td></tr>
              </table>
              <p style="margin: 0 0 4px; color: #5a6b7b;">Asunto</p>
              <p style="margin: 0 0 16px;"><strong>${subject}</strong></p>
              <p style="margin: 0 0 4px; color: #5a6b7b;">Mensaje</p>
              <p style="white-space: pre-wrap; margin: 0;">${body.replace(/</g, "&lt;")}</p>
            </div>
          `,
        })
      } else {
        console.log("[v0] Alerta omitida - Resend en modo prueba")
      }
    }
  } catch (err) {
    console.log("[v0] sendOrganizerMessage - email error:", err instanceof Error ? err.message : String(err))
  }

  revalidatePath("/admin")
  revalidatePath("/superadmin")
  return { success: true }
}

export async function updateMessageStatus(messageId: string, status: "unread" | "read" | "resolved") {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "No autenticado" }
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "superadmin") {
    return { error: "No autorizado" }
  }

  if (!["unread", "read", "resolved"].includes(status)) {
    return { error: "Estado inválido" }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("organizer_messages")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", messageId)

  if (error) {
    console.log("[v0] updateMessageStatus - error:", error.message)
    return { error: "No se pudo actualizar el mensaje" }
  }

  revalidatePath("/superadmin")
  return { success: true }
}
