export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "evento"
}

export async function createUniqueEventSlug(supabase: any, title: string, eventId?: string) {
  const base = slugify(title)
  let slug = base
  let suffix = 2
  while (true) {
    let query = supabase.from("events").select("id").eq("slug", slug).limit(1)
    if (eventId) query = query.neq("id", eventId)
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    if (!data) return slug
    slug = `${base}-${suffix++}`
  }
}
