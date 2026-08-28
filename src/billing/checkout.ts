import { appOrigin, config, isSupabaseConfigured } from "../config"
import { getSupabase } from "../lib/supabase"
import { localUpdateProfile } from "../api/local-backend"

export type BillingProviderChoice = "stripe" | "paypal"

export async function startCheckout(
  provider: BillingProviderChoice,
  userId: string,
): Promise<{ url?: string; message?: string }> {
  if (!isSupabaseConfigured()) {
    // Local demo: activate immediately
    await localUpdateProfile({
      subscription_status: "active",
      billing_provider: provider,
      subscription_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    return { message: "Demo subscription activated" }
  }

  const base = config.billingFunctionsBase
  if (!base) {
    throw new Error(
      "Billing functions URL is not configured (VITE_BILLING_FUNCTIONS_URL)",
    )
  }

  const supabase = getSupabase()!
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error("Not signed in")

  const endpoint =
    provider === "stripe" ? `${base}/stripe-checkout` : `${base}/paypal-subscribe`

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      userId,
      successUrl: `${appOrigin()}/app?subscribed=1`,
      cancelUrl: `${appOrigin()}/pricing?canceled=1`,
      priceId: config.stripePriceId,
      planId: config.paypalPlanId,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "Failed to start checkout")
  }

  return (await response.json()) as { url?: string; message?: string }
}

export async function openCustomerPortal(
  provider: BillingProviderChoice | null,
): Promise<{ url?: string }> {
  if (!provider) throw new Error("No active billing provider")
  if (!isSupabaseConfigured()) {
    return { url: "/pricing" }
  }
  const base = config.billingFunctionsBase
  if (!base) throw new Error("Billing functions URL is not configured")
  const supabase = getSupabase()!
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error("Not signed in")

  const endpoint =
    provider === "stripe" ? `${base}/stripe-portal` : `${base}/paypal-manage`

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ returnUrl: `${appOrigin()}/app` }),
  })
  if (!response.ok) throw new Error(await response.text())
  return (await response.json()) as { url?: string }
}
