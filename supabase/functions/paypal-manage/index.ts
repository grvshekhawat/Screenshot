import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { handleCors, jsonResponse, textResponse } from "../_shared/cors.ts"

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== "POST") return textResponse("Method not allowed", 405)

  const auth = req.headers.get("Authorization")
  if (!auth) return textResponse("Unauthorized", 401)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return textResponse("Unauthorized", 401)

  const { data: profile } = await supabase
    .from("profiles")
    .select("paypal_subscription_id")
    .eq("id", user.id)
    .single()

  const id = profile?.paypal_subscription_id
  if (!id) return textResponse("No PayPal subscription", 400)

  // Sandbox manage URL pattern; production uses paypal.com
  const host = (Deno.env.get("PAYPAL_API_BASE") ?? "").includes("sandbox")
    ? "https://www.sandbox.paypal.com"
    : "https://www.paypal.com"
  return jsonResponse({
    url: `${host}/myaccount/autopay/connect/${id}`,
  })
})
