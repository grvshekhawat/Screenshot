function trimEnv(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v || undefined
}

export const MAX_CLOUD_PROJECTS = 5

/**
 * NEXT_PUBLIC_* must be referenced as static property accesses so Next.js
 * can inline them into the client bundle. Dynamic `process.env[key]` stays
 * undefined in the browser and incorrectly forces local demo mode.
 */
export const config = {
  supabaseUrl: trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
  // Prefer new publishable key (sb_publishable_…); anon key still works as fallback
  supabaseAnonKey:
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  stripePublishableKey: trimEnv(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
  stripePriceId: trimEnv(process.env.NEXT_PUBLIC_STRIPE_PRICE_ID),
  paypalClientId: trimEnv(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID),
  paypalPlanId: trimEnv(process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID),
  billingFunctionsBase: trimEnv(process.env.NEXT_PUBLIC_BILLING_FUNCTIONS_URL),
  appUrl: trimEnv(process.env.NEXT_PUBLIC_APP_URL),
}

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

export function appOrigin(): string {
  const configured = (config.appUrl ?? "").replace(/\/$/, "")
  const live =
    configured && !/localhost|127\.0\.0\.1/i.test(configured) ? configured : ""
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : ""
  const originIsLocal = /localhost|127\.0\.0\.1/i.test(origin)
  // Prefer configured production URL so magic links never fall back to localhost.
  if (live) return live
  if (origin && !originIsLocal) return origin
  return origin || configured || ""
}

/** Canonical site origin for metadata / sitemap (server-safe). */
export function siteOrigin(): string {
  const configured = (config.appUrl ?? "").replace(/\/$/, "")
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured
  if (configured) return configured
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "https://screenshot.design"
}
