// Deno / Supabase Edge Function stubs.
// Deploy with: supabase functions deploy stripe-checkout stripe-portal stripe-webhook paypal-subscribe paypal-manage paypal-webhook
// Set secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID, SUPABASE_SERVICE_ROLE_KEY

/*
stripe-checkout (POST): create Checkout Session, return { url }
stripe-portal (POST): create Billing Portal session, return { url }
stripe-webhook: verify signature, upsert profiles.subscription_status

paypal-subscribe (POST): create PayPal subscription, return { url }
paypal-manage (POST): return PayPal manage URL for subscription id
paypal-webhook: verify + upsert profiles from BILLING.SUBSCRIPTION.* events
*/

export const BILLING_FUNCTIONS = [
  "stripe-checkout",
  "stripe-portal",
  "stripe-webhook",
  "paypal-subscribe",
  "paypal-manage",
  "paypal-webhook",
] as const
