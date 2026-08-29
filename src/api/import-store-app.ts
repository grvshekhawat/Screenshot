import { config, isSupabaseConfigured } from "../config"
import { getSupabase } from "../lib/supabase"
import type { ArtboardOrientation } from "../orientation"
import type { AnalyzedLayout } from "./analyze-store-layout"

export type StoreImportResult = {
  title: string
  description: string
  subtitle: string | null
  store: "apple" | "google"
  orientation: ArtboardOrientation
  assetIds: string[]
  /** Present when Edge analyzed screenshots in-memory (no Storage re-download). */
  layouts?: AnalyzedLayout[]
}

/** Admin-only: scrape listing, upload screenshots, AI-analyze layouts in one call. */
export async function importStoreApp(input: {
  query: string
  country?: string
}): Promise<StoreImportResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Store import requires Supabase (not available in local demo mode).",
    )
  }
  const base = config.billingFunctionsBase
  if (!base) {
    throw new Error(
      "Billing functions URL is not configured (NEXT_PUBLIC_BILLING_FUNCTIONS_URL).",
    )
  }

  const query = input.query.trim()
  if (!query) throw new Error("Enter an App Store / Play URL or Apple app name")

  const supabase = getSupabase()!
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error("Not signed in")

  const response = await fetch(
    `${base.replace(/\/$/, "")}/import-store-app`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        query,
        country: input.country ?? "us",
      }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "Store import failed")
  }

  return (await response.json()) as StoreImportResult
}
