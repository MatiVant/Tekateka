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
    const { data: event, error: eventError } = await supabase.from("events").select("price, status, is_pay_what_you_want, sales_start_at, sales_end_at").eq("id", data.event_id).single()
    if (eventError || !event || event.status !== "active") throw new Error("Evento no disponible")
    const now = Date.now()
    if (event.sales_start_at && now < new Date(event.sales_start_at).getTime()) throw new Error(`La venta comienza el ${new Date(event.sales_start_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`)
    if (event.sales_end_at && now >= new Date(event.sales_end_at).getTime()) throw new Error("La venta para este evento ya finalizó")

    let serverPrice = Number(event.price || 0)
    const originalPrice = serverPrice
    let appliedPromotion: { id: string; promotion_type: string; discount_value: number; max_uses: number | null; current_uses: number; valid_from: string | null; valid_until: string | null } | null = null
    if (data.tier_id) {
      const { data: tier, error: tierError } = await supabase.from("ticket_tiers").select("base_price, available_quantity, sales_start_at, sales_end_at").eq("id", data.tier_id).eq("event_id", data.event_id).single()
      if (tierError || !tier || tier.available_quantity < 1) throw new Error("Tipo de entrada no disponible")
      if (tier.sales_start_at && now < new Date(tier.sales_start_at).getTime()) throw new Error("Este tipo de entrada todavía no está disponible")
      if (tier.sales_end_at && now >= new Date(tier.sales_end_at).getTime()) throw new Error("La venta de este tipo de entrada ya finalizó")
      serverPrice = Number(tier.base_price)
    }
    if (event.is_pay_what_you_want) serverPrice = data.final_price
    if (data.promotion_code) {
      const { data: promo } = await supabase.from("promotion_codes").select("id, promotion_type, discount_value, max_uses, current_uses, valid_from, valid_until, is_active").eq("event_id", data.event_id).eq("code", data.promotion_code.trim().toUpperCase()).single()
      const today = new Date().toISOString().slice(0, 10)
      if (!promo || !promo.is_active || (promo.max_uses && promo.current_uses >= promo.max_uses) || (promo.valid_from && today < promo.valid_from) || (promo.valid_until && today > promo.valid_until)) throw new Error("Código de promoción inválido o expirado")
      if (promo.promotion_type === "2x1" && data.ticketQuantity !== 2) throw new Error("El código 2x1 requiere exactamente 2 entradas")
      if (promo.promotion_type !== "2x1" && data.ticketQuantity !== 1) throw new Error("Este código permite comprar una sola entrada")
      if (promo.promotion_type === "protocol") {
        const normalizedEmail = data.buyer_email.trim().toLowerCase()
        const { data: previousUse, error: previousUseError } = await supabase
          .from("ticket_promotions")
          .select("ticket_id, tickets!inner(event_id, buyer_email)")
          .eq("promotion_code_id", promo.id)
          .eq("tickets.event_id", data.event_id)
          .neq("tickets.status", "cancelled")
          .ilike("tickets.buyer_email", normalizedEmail)
          .limit(1)
          .maybeSingle()
        if (previousUseError) throw new Error("No se pudo verificar el uso del código")
        if (previousUse) throw new Error("Ya usaste este código de entrada gratuita")
      }
      appliedPromotion = promo
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
    const isFreeTicket = Math.max(0, serverPrice) === 0
    const { error: ticketDetailsError } = await supabase.from("tickets").update({ payment_method: isFreeTicket ? "free" : data.payment_method ?? "mercado_pago", payment_status: isFreeTicket ? "approved" : undefined, status: isFreeTicket ? "confirmed" : undefined, buyer_phone: data.buyer_phone?.trim() || null, charged_amount: isFreeTicket ? 0 : data.payment_method === "mercado_pago" ? Math.round(data.final_price * 1.10 * 100) / 100 : data.final_price, payment_fee_amount: isFreeTicket ? 0 : data.payment_method === "mercado_pago" ? Math.round(data.final_price * 0.10 * 100) / 100 : 0, net_amount: isFreeTicket ? 0 : data.final_price }).eq("id", createdTicket.id)
    if (ticketDetailsError) throw new Error("No se pudo confirmar la entrada")

    const resumeToken = randomBytes(32).toString("hex")
    const resumeTokenHash = createHash("sha256").update(resumeToken).digest("hex")
    const resumeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const { error: tokenError } = await supabase.from("tickets").update({ payment_resume_token_hash: resumeTokenHash, payment_resume_expires_at: resumeExpiresAt }).eq("id", createdTicket.id)
    if (tokenError) throw new Error("No se pudo preparar el enlace de pago")

    // Guardar el código y el detalle del descuento aplicado en la entrada.
    if (appliedPromotion) {
      const discountAmount = Math.max(0, originalPrice - Math.max(0, serverPrice))
      const { error: promotionError } = await supabase.from("ticket_promotions").insert({
        ticket_id: createdTicket.id,
        promotion_code_id: appliedPromotion.id,
        original_price: originalPrice,
        discount_amount: discountAmount,
        final_price: Math.max(0, serverPrice),
      })

      if (promotionError) console.error("[v0] Error al guardar promoción del ticket:", promotionError)
      await supabase.rpc("increment_promotion_uses", { promo_id: appliedPromotion.id })
    }

    if (isFreeTicket) {
      try {
        if (resend && data.sendEmail !== false) {
          const { data: eventDetails } = await supabase.from("events").select("title, event_date, venue").eq("id", data.event_id).single()
          const requestHeaders = await headers()
          const forwardedHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host")
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (forwardedHost ? `https://${forwardedHost}` : "https://tktk.buholabs.com.ar")
          const ticketUrl = `${siteUrl.replace(/\/$/, "")}/ticket/${encodeURIComponent(data.qr_code)}`
          const qrImageUrl = `${siteUrl.replace(/\/$/, "")}/api/generate-qr?code=${encodeURIComponent(ticketUrl)}`
          await resend.emails.send({
            from: "TekaTeka <notificaciones@tktk.buholabs.com.ar>",
            to: data.buyer_email,
            subject: `Tu entrada gratuita: ${eventDetails?.title || "TekaTeka"}`,
            html: `<!doctype html><html><body style="margin:0;background:#f4eddf;color:#171717;font-family:Arial,sans-serif"><main style="max-width:620px;margin:auto;padding:28px 18px"><header style="padding:12px 0 22px;border-bottom:4px solid #f4511e"><div style="font-size:34px;font-weight:900;letter-spacing:-2px">Te<span style="color:#f4511e">k</span>aTeka</div><div style="margin-top:10px;font-size:11px;letter-spacing:4px;text-transform:uppercase">Más cultura. Más encuentros.</div></header><section style="background:#fffdf7;border:1px solid #e7dcc8;border-radius:0 0 18px 18px;padding:30px;text-align:center"><p style="color:#f4511e;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Entrada gratuita</p><h1 style="font-size:30px;letter-spacing:-1px">Tu entrada está confirmada</h1><p>Hola ${data.buyer_name}, tu entrada para <strong>${eventDetails?.title || "el evento"}</strong> ya está confirmada.</p><div style="margin:26px 0;padding:24px;background:#fff;border:1px solid #e7dcc8;border-radius:16px"><p><strong>${eventDetails?.event_date ? new Date(eventDetails.event_date).toLocaleString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }) : ""}</strong></p><p>${eventDetails?.venue || ""}</p><img src="${qrImageUrl}" alt="Código QR de entrada" width="280" height="280" style="display:block;width:280px;height:280px;margin:20px auto"><p style="font-family:monospace;font-weight:bold;color:#f4511e">${data.qr_code}</p><p><strong>Presentá este QR al ingresar.</strong></p></div><p><a href="${ticketUrl}" style="display:inline-block;background:#f4511e;color:#fff;padding:13px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir entrada digital</a></p><p style="color:#6b6258;font-size:13px">Este código es único y personal. No lo compartas.</p></section></main></body></html>`,
          })
        }
      } catch (freeEmailError) {
        console.error("[v0] Error al enviar QR de entrada gratuita:", freeEmailError)
      }
      return createdTicket
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
            html: `<p>Hola ${data.buyer_name},</p><p>Recibimos tu reserva de ${entradasLabel} para <strong>${event.title}</strong> por un total de ${totalAmount.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}.</p>${data.payment_method === "transfer" && (event.transfer_alias || event.transfer_account_holder) ? `<p><strong>Recordá hacer la transferencia a:</strong><br />${event.transfer_alias ? `Alias: <strong>${event.transfer_alias}</strong><br />` : ""}${event.transfer_account_holder ? `A nombre de: <strong>${event.transfer_account_holder}</strong>` : ""}</p>` : ""}<p>${data.payment_method === "transfer" ? "Cuando hagas la transferencia, volvé a este enlace para enviar el comprobante." : "Podés retomar el pago desde este enlace:"}</p><p><a href="${resumeUrl}">${data.payment_method === "transfer" ? "Enviar comprobante" : "Continuar con Mercado Pago"}</a></p><p><a href="${resumeUrl}?action=cancel">No voy a comprar esta entrada</a></p><p>El enlace es privado y válido durante 48 horas.</p>`,
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
