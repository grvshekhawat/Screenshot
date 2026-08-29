function publicEnv(name: string): string | undefined {
  const nextKey = `NEXT_PUBLIC_${name}`
  const viteKey = `VITE_${name}`
  const fromNext = process.env[nextKey]
  if (fromNext) return fromNext
  // Allow VITE_* during local migration if copied into .env (Next loads all .env keys server-side;
  // only NEXT_PUBLIC_* is inlined for the browser bundle).
  const fromVite = process.env[viteKey]
  return fromVite || undefined
}

export const MAX_CLOUD_PROJECTS = 5

export const config = {
  supabaseUrl: publicEnv("SUPABASE_URL"),
  // Prefer new publishable key (sb_publishable_…); anon key still works as fallback
  supabaseAnonKey:
    publicEnv("SUPABASE_PUBLISHABLE_KEY") || publicEnv("SUPABASE_ANON_KEY"),
  stripePublishableKey: publicEnv("STRIPE_PUBLISHABLE_KEY"),
  stripePriceId: publicEnv("STRIPE_PRICE_ID"),
  paypalClientId: publicEnv("PAYPAL_CLIENT_ID"),
  paypalPlanId: publicEnv("PAYPAL_PLAN_ID"),
  billingFunctionsBase: publicEnv("BILLING_FUNCTIONS_URL"),
  appUrl: publicEnv("APP_URL"),
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
  if (configured) return configured
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "https://screenshot.design"
}
