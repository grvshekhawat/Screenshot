import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { handleCors, jsonResponse, textResponse } from "../_shared/cors.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
})

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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // 1) Recent completed Checkout sessions tagged with this user
  const sessions = await stripe.checkout.sessions.list({ limit: 30 })
  const mine = sessions.data.find(
    (session) =>
      session.status === "complete" &&
      (session.client_reference_id === user.id ||
        session.metadata?.supabase_user_id === user.id),
  )

  let customerId: string | null =
    typeof mine?.customer === "string" ? mine.customer : mine?.customer?.id ?? null
  let subscriptionId: string | null =
    typeof mine?.subscription === "string"
      ? mine.subscription
      : mine?.subscription?.id ?? null

  // 2) Fallback: customer by email + active subscription
  if (!subscriptionId && user.email) {
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 5,
    })
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 5,
      })
      const active = subs.data.find(
        (sub) =>
          sub.status === "active" ||
          sub.status === "trialing" ||
          sub.metadata?.supabase_user_id === user.id,
      )
      if (active) {
        customerId = customer.id
        subscriptionId = active.id
        break
      }
    }
  }

  if (!subscriptionId) {
    return jsonResponse({
      ok: false,
      subscription_status: "none",
      message: "No completed Stripe checkout found for this user yet",
    })
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const status =
    sub.status === "active" || sub.status === "trialing"
      ? "active"
      : sub.status === "past_due"
        ? "past_due"
        : "canceled"

  const { data, error } = await admin
    .from("profiles")
    .update({
      subscription_status: status,
      billing_provider: "stripe",
      stripe_customer_id: customerId ?? (typeof sub.customer === "string" ? sub.customer : sub.customer.id),
      stripe_subscription_id: sub.id,
      subscription_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id, subscription_status")
    .maybeSingle()

  if (error) return textResponse(error.message, 500)
  if (!data) return textResponse("Profile not found", 404)

  return jsonResponse({
    ok: true,
    subscription_status: data.subscription_status,
  })
})
