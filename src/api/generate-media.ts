import { config, isSupabaseConfigured } from "../config"
import { getSupabase } from "../lib/supabase"
import { normalizeImageFile } from "../image-upload"
import { pngBase64ToFile } from "./generate-clipart"

export type GenerateMediaKind = "demo" | "background"
export type DemoAspect = "iphone" | "ipad"

export type GeneratedMediaImage = {
  imageBase64: string
  mime: string
  revisedPrompt: string | null
}

export type GenerateMediaResult = {
  kind: GenerateMediaKind
  aspect: DemoAspect | null
  name: string | null
  images: GeneratedMediaImage[]
}

/** Match store / device screen ratios so images fill phone frames. */
const DEMO_ASPECT_RATIO: Record<DemoAspect, number> = {
  // iPhone 6.9" artboard 1320×2868
  iphone: 1320 / 2868,
  // iPad 13" artboard 2064×2752
  ipad: 2064 / 2752,
}

/** Admin-only: generate demo screens (5) or one background via Edge Function. */
export async function generateMediaPreview(input: {
  kind: GenerateMediaKind
  prompt: string
  name?: string
  aspect?: DemoAspect
}): Promise<GenerateMediaResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "AI media generation requires Supabase (not available in local demo mode).",
    )
  }
  const base = config.billingFunctionsBase
  if (!base) {
    throw new Error(
      "Billing functions URL is not configured (NEXT_PUBLIC_BILLING_FUNCTIONS_URL).",
    )
  }

  const prompt = input.prompt.trim()
  if (!prompt) throw new Error("Prompt is required")

  const supabase = getSupabase()!
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error("Not signed in")

  const aspect: DemoAspect = input.aspect === "ipad" ? "ipad" : "iphone"

  const response = await fetch(`${base.replace(/\/$/, "")}/generate-media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      kind: input.kind,
      prompt,
      name: input.name?.trim() || undefined,
      aspect,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "Media generation failed")
  }

  const raw = (await response.json()) as {
    kind?: GenerateMediaKind
    aspect?: DemoAspect | null
    name?: string | null
    images?: Array<{
      imageBase64?: string
      mime?: string
      revisedPrompt?: string | null
    }>
  }

  if (!raw.images?.length) throw new Error("No images in generate response")

  const kind = raw.kind === "background" ? "background" : "demo"
  const images: GeneratedMediaImage[] = []
  for (const item of raw.images) {
    if (!item.imageBase64) continue
    const mime = item.mime || "image/webp"
    let file = pngBase64ToFile(
      item.imageBase64,
      `gen.${mime.includes("webp") ? "webp" : "png"}`,
      mime,
    )
    // OpenAI ~2:3 → phone ~9:19.5: center-crop to fill (no letterbox bars).
    if (kind === "demo") {
      file = await coverCropToAspect(file, DEMO_ASPECT_RATIO[aspect])
    }
    const optimized = await normalizeImageFile(file)
    const optimizedBase64 = await blobToBase64(optimized)
    images.push({
      imageBase64: optimizedBase64,
      mime: optimized.type || "image/webp",
      revisedPrompt: item.revisedPrompt ?? null,
    })
  }

  if (!images.length) throw new Error("No usable images after optimize")

  return {
    kind,
    aspect: kind === "demo" ? aspect : null,
    name: raw.name ?? null,
    images,
  }
}

/**
 * Scale + center-crop so the image fills a canvas of `targetAspect` (W/H).
 * Prefer this over letterboxing so phone frames get true full-screen shots.
 */
async function coverCropToAspect(
  file: File,
  targetAspect: number,
): Promise<File> {
  const bitmap = await createImageBitmap(file)
  try {
    const srcW = bitmap.width
    const srcH = bitmap.height
    if (!(srcW > 0 && srcH > 0) || !(targetAspect > 0)) return file

    const srcAspect = srcW / srcH
    if (Math.abs(srcAspect - targetAspect) < 0.02) return file

    let cropW: number
    let cropH: number
    let sx: number
    let sy: number

    if (srcAspect > targetAspect) {
      // Source wider → crop sides
      cropH = srcH
      cropW = Math.max(1, Math.round(srcH * targetAspect))
      sx = Math.round((srcW - cropW) / 2)
      sy = 0
    } else {
      // Source taller → crop top/bottom
      cropW = srcW
      cropH = Math.max(1, Math.round(srcW / targetAspect))
      sx = 0
      sy = Math.round((srcH - cropH) / 2)
    }

    const canvas = document.createElement("canvas")
    canvas.width = cropW
    canvas.height = cropH
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, cropW, cropH)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9),
    )
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, ".webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    })
  } finally {
    bitmap.close()
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
