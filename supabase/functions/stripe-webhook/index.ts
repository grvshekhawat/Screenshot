import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
})

function asId(
  value: string | Stripe.Customer | Stripe.Subscription | null | undefined,
): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  return value.id ?? null
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature")
  if (!signature) return new Response("No signature", { status: 400 })
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature"
    console.error("stripe webhook signature error", message)
    return new Response(message, { status: 400 })
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const userId =
        session.client_reference_id ||
        session.metadata?.supabase_user_id ||
        null
      const customerId = asId(session.customer)
      const subscriptionId = asId(session.subscription)

      if (!userId) {
        console.error("checkout.session.completed missing user id", session.id)
      } else {
        let periodEnd: string | null = null
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId)
            periodEnd = new Date(sub.current_period_end * 1000).toISOString()
          } catch {
            /* ignore */
          }
        }
        const { data, error } = await admin
          .from("profiles")
          .update({
            subscription_status: "active",
            billing_provider: "stripe",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .select("id")

        if (error) {
          console.error("profile update failed", error)
          return new Response(error.message, { status: 500 })
        }
        if (!data?.length) {
          console.error("no profile row for user", userId)
          return new Response("Profile not found", { status: 404 })
        }
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.created"
    ) {
      const sub = event.data.object as Stripe.Subscription
      const status =
        sub.status === "active" || sub.status === "trialing"
          ? "active"
          : sub.status === "past_due"
            ? "past_due"
            : "canceled"
      const userId = sub.metadata?.supabase_user_id || null
      const patch = {
        subscription_status: status,
        subscription_period_end: new Date(
          sub.current_period_end * 1000,
        ).toISOString(),
        stripe_subscription_id: sub.id,
        stripe_customer_id: asId(sub.customer),
        billing_provider: "stripe",
        updated_at: new Date().toISOString(),
      }

      let query = admin.from("profiles").update(patch)
      if (userId) {
        query = query.eq("id", userId)
      } else {
        query = query.eq("stripe_subscription_id", sub.id)
      }
      const { error } = await query
      if (error) {
        console.error("subscription profile update failed", error)
        return new Response(error.message, { status: 500 })
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler error"
    console.error(message)
    return new Response(message, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})
