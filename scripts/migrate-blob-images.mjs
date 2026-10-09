import { list } from '@vercel/blob'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const targets = [
  { table: 'events', column: 'image_url', bucket: 'event-images', prefix: 'events' },
  { table: 'profiles', column: 'organization_cover_image_url', bucket: 'organization-covers', prefix: 'organization-covers' },
  { table: 'site_settings', column: 'homepage_cover_image_url', bucket: 'organization-covers', prefix: 'site-settings' },
]

async function ensureBucket(bucket) {
  const { error } = await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: '10MB' })
  if (error && !/already exists|duplicate/i.test(error.message)) throw error
}

async function getRows(target) {
  const { data, error } = await supabase.from(target.table).select(`id, ${target.column}`).not(target.column, 'is', null)
  if (error) throw error
  return (data ?? []).filter((row) => String(row[target.column]).includes('.public.blob.vercel-storage.com'))
}

async function getBlobs() {
  const blobs = []
  let cursor
  do {
    const result = await list({ cursor, limit: 1000 })
    blobs.push(...result.blobs)
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)
  return blobs
}

const blobs = await getBlobs()
const byUrl = new Map(blobs.map((blob) => [blob.url, blob]))
let migrated = 0
let skipped = 0

for (const target of targets) {
  await ensureBucket(target.bucket)
  const rows = await getRows(target)
  for (const row of rows) {
    const oldUrl = row[target.column]
    const blob = byUrl.get(oldUrl)
    if (!blob) {
      console.warn(`[skip] ${target.table}.${row.id}: Blob no encontrado`)
      skipped++
      continue
    }
    const response = await fetch(blob.downloadUrl || blob.url)
    if (!response.ok) throw new Error(`No se pudo descargar ${oldUrl}: ${response.status}`)
    const body = await response.arrayBuffer()
    const pathname = `${target.prefix}/${row.id}-${blob.pathname.split('/').pop()}`
    const { error: uploadError } = await supabase.storage.from(target.bucket).upload(pathname, body, {
      contentType: blob.contentType || 'application/octet-stream',
      cacheControl: '31536000',
      upsert: true,
    })
    if (uploadError) throw uploadError
    const { data: publicUrl } = supabase.storage.from(target.bucket).getPublicUrl(pathname)
    const { error: updateError } = await supabase.from(target.table).update({ [target.column]: publicUrl.publicUrl }).eq('id', row.id)
    if (updateError) throw updateError
    migrated++
    console.log(`[migrated] ${target.table}.${row.id}`)
  }
}

console.log(`Migración terminada: ${migrated} imágenes migradas, ${skipped} omitidas.`)
console.log('No se tocaron payment_receipt_url ni ningún archivo de comprobante/ticket.')
