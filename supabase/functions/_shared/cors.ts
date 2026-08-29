/** Shared CORS helpers for browser → Edge Function calls. */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  return null
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers)
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value)
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  return new Response(JSON.stringify(body), { ...init, headers })
}

export function textResponse(
  body: string,
  status = 200,
): Response {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/plain;charset=UTF-8" },
  })
}
