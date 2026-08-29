import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { handleCors, jsonResponse, textResponse } from "../_shared/cors.ts"

const PROMPT_SUFFIX =
  ", single subject clipart, centered, clean silhouette cutout, no white border, no outline stroke, no sticker rim, no halo, no text, no watermark, transparent background"

const MAX_PROMPT_LEN = 500

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

  let body: { prompt?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return textResponse("Invalid JSON body", 400)
  }

  const prompt = String(body.prompt ?? "").trim()
  if (!prompt) return textResponse("Prompt is required", 400)
  if (prompt.length > MAX_PROMPT_LEN) {
    return textResponse(`Prompt must be at most ${MAX_PROMPT_LEN} characters`, 400)
  }

  const fullPrompt = `${prompt}${PROMPT_SUFFIX}`

  const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1.5",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "low",
      background: "transparent",
      // WebP keeps alpha and is far smaller than PNG for stickers.
      output_format: "webp",
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    console.error("OpenAI images error:", openaiRes.status, errText)
    let message = "Image generation failed"
    try {
      const parsed = JSON.parse(errText) as {
        error?: { message?: string }
      }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      if (errText) message = errText.slice(0, 300)
    }
    return textResponse(message, 502)
  }

  const result = (await openaiRes.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string; url?: string }>
  }
  const item = result.data?.[0]
  let imageBase64 = item?.b64_json
  let mime = "image/webp"

  // Some responses return a URL instead of b64_json — fetch and encode.
  if (!imageBase64 && item?.url) {
    const imgRes = await fetch(item.url)
    if (!imgRes.ok) {
      return textResponse("Failed to download generated image", 502)
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
    return textResponse("No image data in OpenAI response", 502)
  }

  return jsonResponse({
    // Keep legacy key for older clients; prefer imageBase64 + mime.
    pngBase64: imageBase64,
    imageBase64,
    mime,
    revisedPrompt: item?.revised_prompt ?? null,
    name: body.name ? String(body.name).trim() : null,
  })
})
