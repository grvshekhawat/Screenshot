import { config, isSupabaseConfigured } from "../config"
import { getSupabase } from "../lib/supabase"

export type GenerateClipartResult = {
  pngBase64: string
  revisedPrompt: string | null
  name: string | null
}

/** Admin-only: generate a transparent PNG sticker via Edge Function (OpenAI). */
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

  return (await response.json()) as GenerateClipartResult
}

/** Convert API base64 PNG into a File for upsertLibraryClipart. */
export function pngBase64ToFile(
  pngBase64: string,
  filename = "clipart.png",
): File {
  const binary = atob(pngBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], filename, { type: "image/png" })
}
