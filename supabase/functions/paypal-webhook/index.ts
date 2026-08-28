import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const event = await req.json()
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const eventType = event.event_type as string
  const resource = event.resource ?? {}
  const userId = resource.custom_id as string | undefined
  const subscriptionId = resource.id as string | undefined

  let status: "active" | "past_due" | "canceled" | null = null
  if (
    eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
    eventType === "BILLING.SUBSCRIPTION.UPDATED"
  ) {
    status = resource.status === "ACTIVE" ? "active" : "past_due"
  }
  if (
    eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
    eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
    eventType === "BILLING.SUBSCRIPTION.SUSPENDED"
  ) {
    status = "canceled"
  }

  if (status && (userId || subscriptionId)) {
    const patch = {
      subscription_status: status,
      billing_provider: "paypal" as const,
      paypal_subscription_id: subscriptionId ?? null,
    }
    if (userId) {
      await admin.from("profiles").update(patch).eq("id", userId)
    } else if (subscriptionId) {
      await admin
        .from("profiles")
        .update(patch)
        .eq("paypal_subscription_id", subscriptionId)
    }
  }

  return Response.json({ received: true })
})
