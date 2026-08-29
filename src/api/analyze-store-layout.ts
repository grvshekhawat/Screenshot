import { config, isSupabaseConfigured } from "../config"
import { getSupabase } from "../lib/supabase"

export type AnalyzedBox = {
  x: number
  y: number
  w: number
  h: number
}

export type AnalyzedLayout = {
  background: {
    type: "solid" | "gradient" | "photo"
    colors: string[]
    angle: number
  }
  texts: Array<{
    content: string
    x: number
    y: number
    width: number
    size: number
    color: string
    align: "left" | "center" | "right"
    weight: number
    fontHint: string
  }>
  devices: Array<{
    deviceBox: AnalyzedBox
    screenBox: AnalyzedBox
    rotation: number
    deviceKind: "iphone" | "pixel" | "ipad"
    /** Legacy fields from older analyzer — ignored when deviceBox present */
    x?: number
    y?: number
    scale?: number
  }>
  cliparts: Array<{
    box: AnalyzedBox
    label: string
  }>
  lenses: Array<{
    x: number
    y: number
    width: number
    height: number
    zoom: number
    cornerRadius: number
    borderColor: string
  }>
  notes: string
}

export type AnalyzeStoreLayoutResult = {
  layouts: AnalyzedLayout[]
}

/** Admin-only: vision-analyze imported screenshot assets into editable layouts. */
export async function analyzeStoreLayout(input: {
  assetIds: string[]
}): Promise<AnalyzeStoreLayoutResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Layout analysis requires Supabase (not available in local demo mode).",
    )
  }
  const base = config.billingFunctionsBase
  if (!base) {
    throw new Error(
      "Billing functions URL is not configured (NEXT_PUBLIC_BILLING_FUNCTIONS_URL).",
    )
  }

  const assetIds = input.assetIds.filter(Boolean)
  if (assetIds.length === 0) throw new Error("No assets to analyze")

  const supabase = getSupabase()!
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error("Not signed in")

  const response = await fetch(
    `${base.replace(/\/$/, "")}/analyze-store-layout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ assetIds }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "Layout analysis failed")
  }

  return (await response.json()) as AnalyzeStoreLayoutResult
}
