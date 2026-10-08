import { createClient } from "@/lib/supabase/admin"

export async function uploadPublicFile(bucket: string, path: string, file: File) {
  const supabase = createClient()
  const { error: bucketError } = await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: "10MB" })
  if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
    throw bucketError
  }

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
