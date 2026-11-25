import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

export type CatalogVenue = { id: string; name: string; address: string | null; location_url: string | null; active: boolean | null }
export type VenueProposal = CatalogVenue & {
  created_at: string | null
  proposer: { name: string | null; email: string | null } | null
}

// Espacios para el módulo del superadmin. Si la migración 047 todavía no se
// corrió (no existe la columna status), devuelve el catálogo como antes y sin propuestas.
export async function loadVenuesForSuperadmin(supabase: SupabaseClient) {
  const withStatus = await supabase
    .from("venues")
    .select("id, name, address, location_url, active, status, proposed_by, created_at")
    .order("name")

  if (withStatus.error) {
    const legacy = await supabase.from("venues").select("id, name, address, location_url, active").order("name")
    return { catalog: (legacy.data ?? []) as CatalogVenue[], proposals: [] as VenueProposal[], proposalsEnabled: false }
  }

  const rows = withStatus.data ?? []
  const pending = rows.filter((row) => row.status === "pending")
  const proposerIds = [...new Set(pending.map((row) => row.proposed_by as string | null).filter((id): id is string => Boolean(id)))]
  const { data: proposers } = proposerIds.length
    ? await supabase.from("profiles").select("id, full_name, organization_name, email").in("id", proposerIds)
    : { data: [] as { id: string; full_name: string | null; organization_name: string | null; email: string | null }[] }
  const proposerMap = new Map((proposers ?? []).map((row) => [row.id, row]))

  const proposals: VenueProposal[] = pending
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((row) => {
      const proposer = row.proposed_by ? proposerMap.get(row.proposed_by as string) : undefined
      return {
        id: row.id,
        name: row.name,
        address: row.address,
        location_url: row.location_url,
        active: row.active,
        created_at: row.created_at,
        proposer: proposer ? { name: proposer.organization_name || proposer.full_name, email: proposer.email } : null,
      }
    })

  const catalog = rows
    .filter((row) => row.status !== "pending" && row.status !== "rejected")
    .map(({ id, name, address, location_url, active }) => ({ id, name, address, location_url, active })) as CatalogVenue[]

  return { catalog, proposals, proposalsEnabled: true }
}

// Propuestas del organizador que todavía esperan aprobación (para mostrarlas en el formulario).
export async function getMyPendingVenueProposals(userId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await createAdminClient()
    .from("venues")
    .select("id, name")
    .eq("proposed_by", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
  if (error) return []
  return data ?? []
}
