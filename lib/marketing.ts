import { createHmac } from "node:crypto"

const unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET || process.env.RESEND_API_KEY || "tekateka-unsubscribe-secret"

export function createUnsubscribeToken(email: string) {
  return createHmac("sha256", unsubscribeSecret).update(email.trim().toLowerCase()).digest("hex")
}
