import { heicTo, isHeic } from "heic-to"

const IMAGE_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif,.heic,.heif"

/** Longest side cap — enough for store artboards, cuts 3×/4× camera dumps. */
const MAX_EDGE = 2400
/** WebP quality: strong size cut with little visible loss on UI screenshots. */
const WEBP_QUALITY = 0.8
const JPEG_QUALITY = 0.82

export { IMAGE_ACCEPT }

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  return /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)
}

export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type === "image/heic" || type === "image/heif") return true
  return /\.hei[cf]$/i.test(file.name)
}

function baseName(sourceName: string): string {
  return (
    sourceName.replace(/\.(hei[cf]|jpe?g|png|webp|gif)$/i, "") || "image"
  )
}

function fileFromBlob(blob: Blob, sourceName: string, ext: string, type: string): File {
  return new File([blob], `${baseName(sourceName)}.${ext}`, {
    type,
    lastModified: Date.now(),
  })
}

function scaledSize(width: number, height: number): { width: number; height: number } {
  const edge = Math.max(width, height)
  if (edge <= MAX_EDGE) return { width, height }
  const scale = MAX_EDGE / edge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function canvasFromBitmap(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const size = scaledSize(width, height)
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not create image canvas")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, size.width, size.height)
  return canvas
}

async function canvasFromFile(file: File): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file)
      try {
        return canvasFromBitmap(bitmap, bitmap.width, bitmap.height)
      } finally {
        bitmap.close()
      }
    } catch {
      /* fall through to <img> */
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Could not decode image"))
      el.src = url
    })
    return canvasFromBitmap(img, img.naturalWidth, img.naturalHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Encode canvas as WebP (keeps alpha); fall back to JPEG if WebP unavailable. */
async function encodeOptimized(
  canvas: HTMLCanvasElement,
  sourceName: string,
): Promise<File> {
  const webp = await toBlob(canvas, "image/webp", WEBP_QUALITY)
  if (webp && webp.size > 0) {
    return fileFromBlob(webp, sourceName, "webp", "image/webp")
  }

  const jpeg = await toBlob(canvas, "image/jpeg", JPEG_QUALITY)
  if (jpeg && jpeg.size > 0) {
    return fileFromBlob(jpeg, sourceName, "jpg", "image/jpeg")
  }

  throw new Error("Could not compress image")
}

async function convertHeicNatively(file: File): Promise<HTMLCanvasElement | null> {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file)
      try {
        return canvasFromBitmap(bitmap, bitmap.width, bitmap.height)
      } finally {
        bitmap.close()
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error("native decode failed"))
        el.src = url
      })
      return canvasFromBitmap(img, img.naturalWidth, img.naturalHeight)
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    return null
  }
}

async function convertHeicWithLib(file: File): Promise<HTMLCanvasElement> {
  const blob = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.92,
  })
  if (!(blob instanceof Blob)) {
    throw new Error("Could not convert HEIC image")
  }
  return canvasFromFile(
    new File([blob], `${baseName(file.name)}.jpg`, { type: "image/jpeg" }),
  )
}

/**
 * Decode, downscale, and re-encode uploads as WebP so Supabase storage / egress
 * and IndexedDB stay small. HEIC is converted first.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  const looksHeic = isHeicFile(file) || (await isHeic(file).catch(() => false))

  let canvas: HTMLCanvasElement
  if (looksHeic) {
    const native = await convertHeicNatively(file)
    if (native) {
      canvas = native
    } else {
      try {
        canvas = await convertHeicWithLib(file)
      } catch (err) {
        const detail =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : ""
        throw new Error(
          detail.includes("format not supported") || detail.includes("HEIF")
            ? "This HEIC file isn’t supported in the browser. Export it as JPEG or PNG from Photos, then upload again."
            : "Could not convert HEIC. Try exporting as JPEG or PNG from Photos, then upload again.",
        )
      }
    }
  } else {
    canvas = await canvasFromFile(file)
  }

  const optimized = await encodeOptimized(canvas, file.name)
  // Keep the smaller of original vs optimized when original is already tiny WebP/JPEG
  if (
    !looksHeic &&
    (file.type === "image/webp" || file.type === "image/jpeg") &&
    file.size > 0 &&
    file.size <= optimized.size
  ) {
    return file
  }
  return optimized
}
