import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { handleCors, jsonResponse, textResponse } from "../_shared/cors.ts"

async function paypalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID")!
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET")!
  const base = Deno.env.get("PAYPAL_API_BASE") ?? "https://api-m.sandbox.paypal.com"
  const creds = btoa(`${clientId}:${secret}`)
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  const json = await res.json()
  return { token: json.access_token as string, base }
}

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

  const body = await req.json()
  const { token, base } = await paypalAccessToken()
  const planId = Deno.env.get("PAYPAL_PLAN_ID")!

  const res = await fetch(`${base}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: user.id,
      application_context: {
        brand_name: "Screenshot Studio",
        return_url: body.successUrl,
        cancel_url: body.cancelUrl,
        user_action: "SUBSCRIBE_NOW",
      },
    }),
  })
  const json = await res.json()
  const approve = (json.links as { rel: string; href: string }[] | undefined)?.find(
    (l) => l.rel === "approve",
  )
  return jsonResponse({ url: approve?.href, subscriptionId: json.id })
})
