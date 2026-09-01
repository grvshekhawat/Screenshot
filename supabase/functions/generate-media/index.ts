import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { handleCors, jsonResponse, textResponse } from "../_shared/cors.ts"

const MAX_PROMPT_LEN = 600
const DEMO_COUNT = 5

const DEMO_SUFFIX =
  ". Output a FULL-BLEED flat app UI screenshot that fills the ENTIRE image edge to edge with zero margins. " +
  "The interface must touch all four edges of the canvas — no empty background, no beige/white border, no floating rounded card, no drop shadow around the UI, no device mockup. " +
  "Do NOT draw any phone, tablet, iPhone, iPad, chassis, bezel, frame, hands, or surroundings. " +
  "Screen content only (status bar optional at the very top edge). Clean modern app UI, high detail, no watermark."

const BACKGROUND_SUFFIX =
  ", abstract or scenic full-bleed background for App Store screenshot marketing, soft depth, no text, no logos, no watermarks, no UI chrome, no phone, suitable as slide backdrop"

type MediaKind = "demo" | "background"
type DemoAspect = "iphone" | "ipad"

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== "POST") return textResponse("Method not allowed", 405)

  const auth = req.headers.get("Authorization")
  if (!auth) return textResponse("Unauthorized", 401)

  const openaiKey = Deno.env.get("OPENAI_API_KEY")
  if (!openaiKey) {
    return textResponse("OPENAI_API_KEY is not configured", 500)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return textResponse("Unauthorized", 401)

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError) {
    return textResponse(profileError.message || "Failed to load profile", 500)
  }
  if (profile?.role !== "admin") {
    return textResponse("Admin only", 403)
  }

  let body: {
    kind?: string
    prompt?: string
    name?: string
    aspect?: string
  }
  try {
    body = await req.json()
  } catch {
    return textResponse("Invalid JSON body", 400)
  }

  const kind = String(body.kind ?? "").trim() as MediaKind
  if (kind !== "demo" && kind !== "background") {
    return textResponse('kind must be "demo" or "background"', 400)
  }

  const prompt = String(body.prompt ?? "").trim()
  if (!prompt) return textResponse("Prompt is required", 400)
  if (prompt.length > MAX_PROMPT_LEN) {
    return textResponse(`Prompt must be at most ${MAX_PROMPT_LEN} characters`, 400)
  }

  const aspectRaw = String(body.aspect ?? "iphone").trim()
  const aspect: DemoAspect =
    aspectRaw === "ipad" ? "ipad" : "iphone"

  // gpt-image portrait 1024x1536 ≈ 2:3 — close to iPhone (~0.46) and iPad 11 (~0.66).
  // Slightly different prompt hints keep layouts distinct per aspect.
  const size = "1024x1536"
  const aspectHint =
    aspect === "ipad"
      ? " Design a tablet app UI that fills the whole canvas edge to edge."
      : " Design a tall smartphone app UI that fills the whole canvas edge to edge."

  const count = kind === "demo" ? DEMO_COUNT : 1
  const fullPrompt =
    kind === "demo"
      ? `${prompt}.${aspectHint}${DEMO_SUFFIX}`
      : `${prompt}${BACKGROUND_SUFFIX}`

  const images: Array<{
    imageBase64: string
    mime: string
    revisedPrompt: string | null
  }> = []

  // gpt-image-1.5 typically returns one image per request — parallel calls for demos.
  const tasks = Array.from({ length: count }, (_, i) =>
    generateOne(openaiKey, fullPrompt, size, kind === "demo" ? i + 1 : undefined),
  )
  const results = await Promise.all(tasks)
  for (const item of results) {
    if (item.error) {
      return textResponse(item.error, 502)
    }
    images.push({
      imageBase64: item.imageBase64!,
      mime: item.mime!,
      revisedPrompt: item.revisedPrompt,
    })
  }

  return jsonResponse({
    kind,
    aspect: kind === "demo" ? aspect : null,
    name: body.name ? String(body.name).trim() : null,
    images,
  })
})

async function generateOne(
  openaiKey: string,
  prompt: string,
  size: string,
  variant?: number,
): Promise<{
  imageBase64?: string
  mime?: string
  revisedPrompt: string | null
  error?: string
}> {
  const variantHint =
    variant != null
      ? ` Variation ${variant} of ${DEMO_COUNT}: a different app screen or UI state. Full-bleed UI only — fill the canvas completely, never a physical device or floating card.`
      : ""

  const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1.5",
      prompt: `${prompt}${variantHint}`,
      n: 1,
      size,
      quality: "low",
      output_format: "webp",
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    console.error("OpenAI images error:", openaiRes.status, errText)
    let message = "Image generation failed"
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      if (errText) message = errText.slice(0, 300)
    }
    return { revisedPrompt: null, error: message }
  }

  const result = (await openaiRes.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string; url?: string }>
  }
  const item = result.data?.[0]
  let imageBase64 = item?.b64_json
  let mime = "image/webp"

  if (!imageBase64 && item?.url) {
    const imgRes = await fetch(item.url)
    if (!imgRes.ok) {
      return { revisedPrompt: null, error: "Failed to download generated image" }
    }
    const bytes = new Uint8Array(await imgRes.arrayBuffer())
    let binary = ""
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!)
    }
    imageBase64 = btoa(binary)
    const ct = (imgRes.headers.get("content-type") || "").toLowerCase()
    if (ct.includes("png")) mime = "image/png"
    else if (ct.includes("jpeg") || ct.includes("jpg")) mime = "image/jpeg"
    else mime = "image/webp"
  }

  if (!imageBase64) {
    return { revisedPrompt: null, error: "No image data in OpenAI response" }
  }

  return {
    imageBase64,
    mime,
    revisedPrompt: item?.revised_prompt ?? null,
  }
}
