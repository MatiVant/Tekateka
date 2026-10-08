import { uploadPublicFile } from "@/lib/supabase/storage-upload"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function isValidImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  }
  if (type === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  }
  return false
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  const fetchSite = request.headers.get("sec-fetch-site")
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
  const requestHost = forwardedHost || request.headers.get("host")
  let originHost: string | null = null
  try {
    originHost = origin ? new URL(origin).host : null
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 403 })
  }
  if (
    fetchSite === "cross-site" ||
    (fetchSite !== "same-origin" && (!originHost || originHost !== requestHost))
  ) {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "organizer" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Elegí una imagen para la portada." }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "La portada debe pesar menos de 5 MB." }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!isValidImageSignature(bytes, file.type)) {
      return NextResponse.json({ error: "Elegí una imagen JPG, PNG o WebP válida." }, { status: 400 })
    }

    const extensionByType = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const
    const pathname = `organization-covers/${user.id}/${crypto.randomUUID()}.${extensionByType[file.type as keyof typeof extensionByType]}`
    const url = await uploadPublicFile("organization-covers", pathname, file)

    return NextResponse.json({ url })
  } catch (error) {
    console.error("Organization cover upload failed:", error)
    return NextResponse.json({ error: "No se pudo subir la portada." }, { status: 500 })
  }
}
