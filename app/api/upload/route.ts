import { uploadPublicFile } from "@/lib/supabase/storage-upload"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Solo se permiten archivos JPG, PNG, WebP o PDF" }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El comprobante debe pesar menos de 5 MB" }, { status: 400 })
    }

    const url = await uploadPublicFile("event-images", `events/${crypto.randomUUID()}-${file.name}`, file)

    return NextResponse.json({
      url,
      filename: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "STORAGE_UPLOAD_UNAVAILABLE" }, { status: 503 })
  }
}
