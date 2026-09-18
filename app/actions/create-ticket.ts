"use server"

import { createClient } from "@/lib/supabase/admin"
import { Resend } from "resend"
import { createHash, randomBytes } from "node:crypto"
import { headers } from "next/headers"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface CreateTicketData {
  event_id: string
  tier_id: string | null
  buyer_name: string
  buyer_email: string
  buyer_phone?: string | null
  qr_code: string
  promotion_code?: string
  final_price: number
  payment_method?: "mercado_pago" | "external_link" | "transfer" | "free"
  marketing_consent?: boolean
  buyer_id?: string | null
  sendEmail?: boolean
  ticketQuantity?: number
}

export async function createTicket(data: CreateTicketData) {
  const supabase = createClient()

  try {
    if (!Number.isFinite(data.final_price) || data.final_price < 0) throw new Error("Precio inválido")
    const { data: event, error: eventError } = await supabase.from("events").select("price, status, is_pay_what_you_want").eq("id", data.event_id).single()
    if (eventError || !event || event.status !== "active") throw new Error("Evento no disponible")

    let serverPrice = Number(event.price || 0)
    if (data.tier_id) {
      const { data: tier, error: tierError } = await supabase.from("ticket_tiers").select("base_price, available_quantity").eq("id", data.tier_id).eq("event_id", data.event_id).single()
      if (tierError || !tier || tier.available_quantity < 1) throw new Error("Tipo de entrada no disponible")
      serverPrice = Number(tier.base_price)
    }
    if (event.is_pay_what_you_want) serverPrice = data.final_price
    if (data.promotion_code) {
      const { data: promo } = await supabase.from("promotion_codes").select("promotion_type, discount_value, max_uses, current_uses, valid_from, valid_until, is_active").eq("event_id", data.event_id).eq("code", data.promotion_code.trim().toUpperCase()).single()
      const today = new Date().toISOString().slice(0, 10)
      if (!promo || !promo.is_active || promo.current_uses >= promo.max_uses || today < promo.valid_from || today > promo.valid_until) throw new Error("Código de promoción inválido o expirado")
      if (promo.promotion_type === "protocol") serverPrice = 0
      if (promo.promotion_type === "percentage") serverPrice = serverPrice * (1 - Number(promo.discount_value) / 100)
      if (promo.promotion_type === "fixed") serverPrice = Math.max(0, serverPrice - Number(promo.discount_value))
      if (promo.promotion_type === "2x1") serverPrice = serverPrice / 2
    }
    if (Math.abs(Number(data.final_price) - Math.max(0, serverPrice)) > 0.01) throw new Error("El precio de la compra cambió, actualizá la página")

    const { data: ticket, error: ticketError } = await supabase.rpc("create_ticket_atomic", {
      p_event_id: data.event_id,
      p_tier_id: data.tier_id,
      p_buyer_name: data.buyer_name,
      p_buyer_email: data.buyer_email,
      p_qr_code: data.qr_code,
      p_final_price: data.final_price,
      p_buyer_id: data.buyer_id ?? null,
      p_marketing_consent: data.marketing_consent ?? false,
    })

    if (ticketError) {
      console.error("[v0] Error al crear ticket atómico:", ticketError)
      throw new Error(ticketError.message)
    }

    const createdTicket = Array.isArray(ticket) ? ticket[0] : ticket
    if (!createdTicket) throw new Error("No se pudo crear el ticket")
    await supabase.from("tickets").update({ payment_method: data.payment_method ?? "mercado_pago", buyer_phone: data.buyer_phone?.trim() || null, charged_amount: data.payment_method === "mercado_pago" ? Math.round(data.final_price * 1.08 * 100) / 100 : data.final_price, payment_fee_amount: data.payment_method === "mercado_pago" ? Math.round(data.final_price * 0.08 * 100) / 100 : 0, net_amount: data.final_price }).eq("id", createdTicket.id)

    const resumeToken = randomBytes(32).toString("hex")
    const resumeTokenHash = createHash("sha256").update(resumeToken).digest("hex")
    const resumeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const { error: tokenError } = await supabase.from("tickets").update({ payment_resume_token_hash: resumeTokenHash, payment_resume_expires_at: resumeExpiresAt }).eq("id", createdTicket.id)
    if (tokenError) throw new Error("No se pudo preparar el enlace de pago")

    // Si hay código de promoción, guardarlo en la tabla de relación
    if (data.promotion_code) {
      const { data: promoData } = await supabase
        .from("promotion_codes")
        .select("id")
        .eq("event_id", data.event_id)
        .eq("code", data.promotion_code.toUpperCase())
        .single()

      if (promoData) {
        await supabase.from("ticket_promotions").insert({
          ticket_id: createdTicket.id,
          promotion_code_id: promoData.id,
        })

        // Incrementar el contador de usos
        await supabase.rpc("increment_promotion_uses", { promo_id: promoData.id })
      }
    }

    // Enviar email de confirmación de compra (con instrucciones de pago)
    // Cuando la compra incluye varias entradas, se crean varios tickets pero solo
    // se debe enviar un único email consolidado (controlado por data.sendEmail).
    try {
      if (data.sendEmail !== false) {
        const { data: event } = await supabase
          .from("events")
          .select("title, mercado_pago_link, transfer_alias, transfer_account_holder, organizer_id")
          .eq("id", data.event_id)
          .single()

        if (resend && event) {
          const quantity = data.ticketQuantity ?? 1
          const totalAmount = data.final_price * quantity
          const entradasLabel = quantity === 1 ? "entrada" : `${quantity} entradas`
          const { data: organizer } = await supabase.from("profiles").select("email, full_name").eq("id", event.organizer_id).maybeSingle()
          const requestHeaders = await headers()
          const forwardedHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host")
          const forwardedProto = requestHeaders.get("x-forwarded-proto") || (forwardedHost?.includes("localhost") ? "http" : "https")
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
          const resumeUrl = `${siteUrl.replace(/\/$/, "")}/pay/${resumeToken}`
          await resend.emails.send({
            from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
            to: data.buyer_email,
            subject: `Compra recibida: ${event.title}`,
            html: `<p>Hola ${data.buyer_name},</p><p>Recibimos tu reserva de ${entradasLabel} para <strong>${event.title}</strong> por un total de ${totalAmount.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}.</p>${data.payment_method === "transfer" && (event.transfer_alias || event.transfer_account_holder) ? `<p><strong>Recordá hacer la transferencia a:</strong><br />${event.transfer_alias ? `Alias: <strong>${event.transfer_alias}</strong><br />` : ""}${event.transfer_account_holder ? `A nombre de: <strong>${event.transfer_account_holder}</strong>` : ""}</p>` : ""}<p>Tu pago queda pendiente de confirmación. Podés retomar la compra desde este enlace:</p><p><a href="${resumeUrl}">Continuar con mi compra</a></p><p>El enlace es privado y válido durante 48 horas.</p>`,
          })
          if (organizer?.email && organizer.email !== data.buyer_email) {
            await resend.emails.send({
              from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
              to: organizer.email,
              subject: `Nueva compra pendiente de confirmación: ${event.title}`,
              html: `<p>Hola ${organizer.full_name || ""},</p><p>Se creó una nueva compra de ${entradasLabel} para <strong>${event.title}</strong>.</p><p>Comprador: ${data.buyer_name} (${data.buyer_email}).</p><p>Ingres�� al panel de administración para revisar el pago y confirmar las entradas cuando corresponda.</p>`,
            })
          }
        }
      }
    } catch (emailError) {
      console.error("[v0] Error al enviar email:", emailError)
      // No lanzar error, el ticket ya fue creado
    }

    return createdTicket
  } catch (error) {
    console.error("[v0] Error en createTicket:", error)
    throw error
  }
}
