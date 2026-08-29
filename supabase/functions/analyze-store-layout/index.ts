import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  analyzeLayoutFromBytes,
  fallbackLayout,
  mimeFromContentType,
  type AnalyzedLayout,
} from "../_shared/analyze-layout.ts"
import { handleCors, jsonResponse, textResponse } from "../_shared/cors.ts"

const MAX_ASSETS = 6

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

  let body: { assetIds?: string[] }
  try {
    body = await req.json()
  } catch {
    return textResponse("Invalid JSON body", 400)
  }

  const assetIds = Array.isArray(body.assetIds)
    ? body.assetIds.map((id) => String(id).trim()).filter(Boolean).slice(0, MAX_ASSETS)
    : []
  if (assetIds.length === 0) {
    return textResponse("assetIds required", 400)
  }

  // Prefer import-store-app (analyzes in-memory). This path still downloads —
  // kept for rare re-analyze of existing assets.
  const layouts: AnalyzedLayout[] = []
  for (const assetId of assetIds) {
    const path = `${user.id}/${assetId}`
    const { data: file, error: downloadError } = await supabase.storage
      .from("project-assets")
      .download(path)
    if (downloadError || !file) {
      console.error("download failed", assetId, downloadError?.message)
      layouts.push(fallbackLayout())
      continue
    }
    const buffer = new Uint8Array(await file.arrayBuffer())
    const mime = mimeFromContentType(file.type || "image/jpeg")
    try {
      layouts.push(await analyzeLayoutFromBytes(openaiKey, buffer, mime))
    } catch (err) {
      console.error("analyze failed", assetId, err)
      layouts.push(fallbackLayout())
    }
  }

  return jsonResponse({ layouts })
})
