import { redirect } from "next/navigation"
import { requireSuperadmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { authorized, user } = await requireSuperadmin()
  if (!user) redirect("/auth/login")
  if (!authorized) redirect("/")
  return <>{children}</>
}
