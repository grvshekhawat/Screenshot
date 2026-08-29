import { config, isSupabaseConfigured } from "../config"
import { getSupabase } from "../lib/supabase"
import { normalizeClipartFile } from "../image-upload"

export type GenerateClipartResult = {
  /** @deprecated use imageBase64 — may be webp or png */
  pngBase64: string
  imageBase64: string
  mime: string
  revisedPrompt: string | null
  name: string | null
}

/** Admin-only: generate a transparent sticker via Edge Function (OpenAI). */
export async function generateClipartPreview(input: {
  prompt: string
  name?: string
}): Promise<GenerateClipartResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "AI clipart generation requires Supabase (not available in local demo mode).",
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

  const response = await fetch(`${base.replace(/\/$/, "")}/generate-clipart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      prompt,
      name: input.name?.trim() || undefined,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "Clipart generation failed")
  }

  const raw = (await response.json()) as {
    pngBase64?: string
    imageBase64?: string
    mime?: string
    revisedPrompt?: string | null
    name?: string | null
  }

  const imageBase64 = raw.imageBase64 || raw.pngBase64
  if (!imageBase64) throw new Error("No image data in generate response")
  const mime = raw.mime || "image/png"

  // Downscale + WebP before preview/publish so library assets stay ~tens of KB.
  const rawFile = base64ToFile(imageBase64, mime, "clipart")
  const optimized = await normalizeClipartFile(rawFile)
  const optimizedBase64 = await blobToBase64(optimized)

  return {
    pngBase64: optimizedBase64,
    imageBase64: optimizedBase64,
    mime: optimized.type || "image/webp",
    revisedPrompt: raw.revisedPrompt ?? null,
    name: raw.name ?? null,
  }
}

function base64ToFile(base64: string, mime: string, basename: string): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const ext = mime.includes("webp")
    ? "webp"
    : mime.includes("jpeg") || mime.includes("jpg")
      ? "jpg"
      : "png"
  return new File([bytes], `${basename}.${ext}`, { type: mime })
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

/** Convert API base64 image into a File for upsertLibraryClipart. */
export function pngBase64ToFile(
  pngBase64: string,
  filename = "clipart.png",
  mime = "image/png",
): File {
  const binary = atob(pngBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const type =
    mime ||
    (filename.endsWith(".webp")
      ? "image/webp"
      : filename.endsWith(".jpg") || filename.endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png")
  return new File([bytes], filename, { type })
}
