export const MAX_CLOUD_PROJECTS = 5

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  // Prefer new publishable key (sb_publishable_…); anon key still works as fallback
  supabaseAnonKey:
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined),
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
    | string
    | undefined,
  stripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID as string | undefined,
  paypalClientId: import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined,
  paypalPlanId: import.meta.env.VITE_PAYPAL_PLAN_ID as string | undefined,
  billingFunctionsBase: import.meta.env.VITE_BILLING_FUNCTIONS_URL as
    | string
    | undefined,
  appUrl: import.meta.env.VITE_APP_URL as string | undefined,
}

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

export function appOrigin(): string {
  return config.appUrl ?? (typeof window !== "undefined" ? window.location.origin : "")
}
