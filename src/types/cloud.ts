import type { Project } from "../types"

export type UserRole = "user" | "admin"
export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled"
export type BillingProvider = "stripe" | "paypal" | null

export type Profile = {
  id: string
  email: string | null
  role: UserRole
  subscription_status: SubscriptionStatus
  subscription_period_end: string | null
  billing_provider: BillingProvider
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  paypal_subscriber_id: string | null
  paypal_subscription_id: string | null
}

export type ProjectRecord = {
  id: string
  user_id: string
  name: string
  target_id: string
  data: Project
  thumbnail_path: string | null
  /** Resolved URL for project cards (data URL or storage). */
  thumbnail_url?: string | null
  created_at: string
  updated_at: string
}

export type TemplateRecord = {
  id: string
  slug: string
  title: string
  description: string
  preview_path: string | null
  /** Resolved URL (data URL, http, or signed storage URL) for gallery cards. */
  preview_url?: string | null
  data: Project
  sort_order: number
  published: boolean
}

export type LibraryClipartRecord = {
  id: string
  name: string
  category: string
  storage_path: string
  sort_order: number
  published: boolean
  /** Resolved public URL for display */
  url?: string
}

export function canExport(profile: Profile | null): boolean {
  return profile?.subscription_status === "active"
}
