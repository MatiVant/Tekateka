export type ImageCompressionOptions = {
  maxWidth: number
  maxHeight: number
  quality?: number
  maxBytes?: number
}

const DEFAULT_OPTIONS: ImageCompressionOptions = {
  maxWidth: 1600,
  maxHeight: 1200,
  quality: 0.78,
  maxBytes: 900 * 1024,
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("No se pudo procesar la imagen"))
    }, "image/webp", quality)
  })
}

export async function compressImage(file: File, options: Partial<ImageCompressionOptions> = {}) {
  if (!file.type.startsWith("image/")) return file

  const settings = { ...DEFAULT_OPTIONS, ...options }
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = "async"
    image.src = sourceUrl
    await image.decode()

    const scale = Math.min(1, settings.maxWidth / image.naturalWidth, settings.maxHeight / image.naturalHeight)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("No se pudo preparar la imagen")
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    let quality = settings.quality ?? 0.78
    let blob = await canvasToBlob(canvas, quality)
    while (settings.maxBytes && blob.size > settings.maxBytes && quality > 0.5) {
      quality -= 0.06
      blob = await canvasToBlob(canvas, quality)
    }

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

export async function compressReceipt(file: File) {
  return compressImage(file, { maxWidth: 1800, maxHeight: 1800, quality: 0.76, maxBytes: 1_200 * 1024 })
}

export async function compressCover(file: File) {
  return compressImage(file, { maxWidth: 1920, maxHeight: 720, quality: 0.8, maxBytes: 900 * 1024 })
}

export async function compressEventImage(file: File) {
  return compressImage(file, { maxWidth: 1600, maxHeight: 1000, quality: 0.78, maxBytes: 900 * 1024 })
}

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}
