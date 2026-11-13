"use server"

import { createClient } from "@/lib/supabase/admin"

export type PendingPurchase = {
  ticketIds: string[]
  quantity: number
  paymentMethod: "mercado_pago" | "external_link" | "transfer" | "free"
  total: number
  purchasedAt: string
}

export async function findPendingPurchase(eventId: string, email: string): Promise<PendingPurchase | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!eventId || !normalizedEmail) return null

  const supabase = createClient()
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, purchase_group_id, payment_method, final_price, purchased_at")
    .eq("event_id", eventId)
    .ilike("buyer_email", normalizedEmail)
    .eq("status", "pending")
    .gte("purchased_at", cutoff)
    .not("purchase_group_id", "is", null)
    .order("purchased_at", { ascending: false })

  if (error || !tickets?.length) return null
  const groupId = tickets[0].purchase_group_id
  const group = tickets.filter((ticket) => ticket.purchase_group_id === groupId)
  const paymentMethod = group[0].payment_method
  if (!["mercado_pago", "external_link", "transfer", "free"].includes(paymentMethod)) return null

  return {
    ticketIds: group.map((ticket) => ticket.id),
    quantity: group.length,
    paymentMethod: paymentMethod as PendingPurchase["paymentMethod"],
    total: group.reduce((sum, ticket) => sum + Number(ticket.final_price || 0), 0),
    purchasedAt: group[0].purchased_at,
  }
}
