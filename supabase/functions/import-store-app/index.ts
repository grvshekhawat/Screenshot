import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  analyzeLayoutsFromBytes,
  mimeFromContentType,
  type AnalyzedLayout,
} from "../_shared/analyze-layout.ts"
import { handleCors, jsonResponse, textResponse } from "../_shared/cors.ts"

const MAX_SCREENSHOTS = 6
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; ScreenshotStudioBot/1.0; +https://screenshot.design)",
  Accept: "text/html,application/json,*/*",
}

type StoreKind = "apple" | "google"
type Orientation = "portrait" | "landscape"

type Listing = {
  title: string
  description: string
  subtitle: string | null
  store: StoreKind
  screenshotUrls: string[]
}

function parseAppleId(query: string): string | null {
  const idMatch = query.match(/(?:id|\/id)(\d{6,})/i) || query.match(/\bid(\d{6,})\b/i)
  if (idMatch?.[1]) return idMatch[1]
  try {
    const url = new URL(query)
    if (
      /apps\.apple\.com|itunes\.apple\.com/i.test(url.hostname) ||
      url.hostname.endsWith("apple.com")
    ) {
      const fromPath = url.pathname.match(/id(\d+)/i)
      if (fromPath?.[1]) return fromPath[1]
    }
  } catch {
    /* not a URL */
  }
  return null
}

function parsePlayId(query: string): string | null {
  try {
    const url = new URL(query)
    if (/play\.google\.com/i.test(url.hostname)) {
      const id = url.searchParams.get("id")
      if (id) return id
    }
  } catch {
    /* not a URL */
  }
  const bare = query.match(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i)
  return bare ? bare[0] : null
}

function scrapeAppleScreenshotUrls(html: string): string[] {
  const pattern =
    /https:\/\/is\d+-ssl\.mzstatic\.com\/image\/thumb\/[^"\s\\]+?\/(\d{3,4})x(\d{3,4})bb(?:-\d+)?\.(?:png|jpg|webp|jpeg)/gi
  const best = new Map<string, { url: string; w: number; h: number }>()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) !== null) {
    const url = match[0]
    const w = Number(match[1])
    const h = Number(match[2])
    if (!(w > 0 && h > 0)) continue
    // Prefer portrait (h > w); skip tiny thumbs
    if (h <= w) continue
    if (w < 200) continue
    const base = url.replace(/\/\d{3,4}x\d{3,4}bb(?:-\d+)?\.(?:png|jpg|webp|jpeg)$/i, "")
    const prev = best.get(base)
    if (!prev || w * h > prev.w * prev.h) {
      best.set(base, { url, w, h })
    }
  }
  return [...best.values()].map((item) => item.url)
}

async function fetchAppleById(
  appId: string,
  country: string,
): Promise<Listing> {
  const lookupRes = await fetch(
    `https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}&country=${encodeURIComponent(country)}`,
    { headers: FETCH_HEADERS },
  )
  if (!lookupRes.ok) {
    throw new Error(`iTunes lookup failed (${lookupRes.status})`)
  }
  const lookup = (await lookupRes.json()) as {
    results?: Array<{
      trackName?: string
      description?: string
      screenshotUrls?: string[]
      ipadScreenshotUrls?: string[]
    }>
  }
  const row = lookup.results?.[0]
  if (!row) throw new Error("App not found on the App Store")

  let screenshots = [...(row.screenshotUrls ?? [])]
  // Prefer phone screenshots from lookup; only fall back to HTML scrape when empty.
  let subtitle: string | null = null
  try {
    const pageRes = await fetch(
      `https://apps.apple.com/${country}/app/id${appId}`,
      { headers: FETCH_HEADERS },
    )
    if (pageRes.ok) {
      const html = await pageRes.text()
      if (screenshots.length === 0) {
        screenshots = scrapeAppleScreenshotUrls(html)
      }
      const sub =
        html.match(
          /class="[^"]*product-header__subtitle[^"]*"[^>]*>([^<]+)</i,
        )?.[1] ||
        html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1]
      if (sub) subtitle = decodeHtml(sub).slice(0, 160)
    }
  } catch {
    /* keep lookup screenshots */
  }

  // Upscale common thumb sizes in Apple CDN URLs for sharper imports.
  screenshots = screenshots.map((url) =>
    url.replace(
      /\/(\d{2,4})x(\d{2,4})([a-z]*)\.(jpg|jpeg|png|webp)/i,
      "/1242x2688$3.$4",
    ),
  )

  return {
    title: row.trackName?.trim() || `App ${appId}`,
    description: (row.description ?? "").trim(),
    subtitle,
    store: "apple",
    screenshotUrls: uniqueUrls(screenshots),
  }
}

async function searchAppleByName(
  term: string,
  country: string,
): Promise<Listing> {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&country=${encodeURIComponent(country)}&limit=1`,
    { headers: FETCH_HEADERS },
  )
  if (!res.ok) throw new Error(`iTunes search failed (${res.status})`)
  const data = (await res.json()) as {
    results?: Array<{ trackId?: number }>
  }
  const id = data.results?.[0]?.trackId
  if (!id) {
    throw new Error(
      "No App Store match for that name. Try a full apps.apple.com link.",
    )
  }
  return fetchAppleById(String(id), country)
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\+/g, " ")
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const url = raw.replace(/\\u003d/g, "=").replace(/\\u0026/g, "&").trim()
    if (!url.startsWith("http")) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  )
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  )
  const m = html.match(re) || html.match(re2)
  return m?.[1] ? decodeHtml(m[1]) : null
}

function scrapePlayScreenshotUrls(html: string): string[] {
  // Play’s =wN-hM URL params are *layout* sizes, not intrinsic pixels — do NOT
  // trust aspect from them or force =w1080-h1920 (that warps icons into zooms).
  // Collect unique image bases, then request width-only (=w1080-rw). Real phone
  // screenshots decode as ~1080×2336; icons stay square and are dropped later.
  const re =
    /https:\/\/play-lh\.googleusercontent\.com\/(?!a-|a\/)[^"'\\\s>]+/gi
  const bases: string[] = []
  const seen = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    let url = match[0]
      .replace(/\\u003d/g, "=")
      .replace(/\\u0026/g, "&")
      .replace(/\\u00253D/gi, "=")
    url = url.replace(/[),;]+$/g, "")
    const base = (url.split("=")[0] ?? "").trim()
    if (!base.startsWith("https://play-lh.googleusercontent.com/")) continue
    // Skip tiny badge/avatar-looking path fragments already excluded by (?!a-)
    if (seen.has(base)) continue
    seen.add(base)
    bases.push(base)
  }

  // Width-only request preserves true aspect. Prefer 1080; bump later if needed.
  return bases.map((base) => `${base}=w1080-rw`)
}

async function fetchPlayById(appId: string, country: string): Promise<Listing> {
  const pageRes = await fetch(
    `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}&hl=en&gl=${encodeURIComponent(country)}`,
    { headers: FETCH_HEADERS },
  )
  if (!pageRes.ok) {
    throw new Error(
      `Play Store fetch failed (${pageRes.status}). Google may block scrapers — try again or use an App Store link.`,
    )
  }
  const html = await pageRes.text()
  const title =
    extractMeta(html, "og:title")?.replace(/\s*-\s*Apps on Google Play$/i, "") ||
    html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)</i)?.[1] ||
    appId
  const description =
    extractMeta(html, "og:description") ||
    extractMeta(html, "description") ||
    ""
  const screenshots = scrapePlayScreenshotUrls(html)
  if (screenshots.length === 0) {
    throw new Error(
      "Could not find Play Store screenshots on the listing page. Google’s HTML may have changed.",
    )
  }
  return {
    title: decodeHtml(title).trim(),
    description: description.trim(),
    subtitle: null,
    store: "google",
    screenshotUrls: screenshots,
  }
}

async function resolveListing(
  query: string,
  country: string,
): Promise<Listing> {
  const trimmed = query.trim()
  if (!trimmed) throw new Error("Query is required")

  const appleId = parseAppleId(trimmed)
  if (appleId) return fetchAppleById(appleId, country)

  if (/play\.google\.com/i.test(trimmed) || parsePlayId(trimmed)) {
    const playId = parsePlayId(trimmed)
    if (!playId) {
      throw new Error("Could not parse Play Store app id from that URL")
    }
    // Bare package ids without URL: treat as Play only if it looks like a package
    if (
      /play\.google\.com/i.test(trimmed) ||
      /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(trimmed)
    ) {
      // Name-like strings won't match package regex with dots only for packages
      if (/play\.google\.com/i.test(trimmed)) {
        return fetchPlayById(playId, country)
      }
      // Ambiguous bare package — allow
      if (trimmed.includes(".")) return fetchPlayById(playId, country)
    }
  }

  // Free-text name → Apple search only (MVP)
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      "Unrecognized store URL. Use apps.apple.com/… or play.google.com/store/apps/details?id=…",
    )
  }
  return searchAppleByName(trimmed, country)
}

function readWebpSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (
    bytes.length < 30 ||
    bytes[0] !== 0x52 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x46 ||
    bytes[8] !== 0x57 ||
    bytes[9] !== 0x45 ||
    bytes[10] !== 0x42 ||
    bytes[11] !== 0x50
  ) {
    return null
  }

  // Walk RIFF chunks — Play serves VP8X / VP8 / VP8L.
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const tag = String.fromCharCode(
      bytes[offset]!,
      bytes[offset + 1]!,
      bytes[offset + 2]!,
      bytes[offset + 3]!,
    )
    const size =
      bytes[offset + 4]! |
      (bytes[offset + 5]! << 8) |
      (bytes[offset + 6]! << 16) |
      (bytes[offset + 7]! << 24)
    const dataStart = offset + 8
    const dataEnd = Math.min(bytes.length, dataStart + size)

    if (tag === "VP8X" && dataStart + 10 <= dataEnd) {
      const w =
        1 +
        (bytes[dataStart + 4]! |
          (bytes[dataStart + 5]! << 8) |
          (bytes[dataStart + 6]! << 16))
      const h =
        1 +
        (bytes[dataStart + 7]! |
          (bytes[dataStart + 8]! << 8) |
          (bytes[dataStart + 9]! << 16))
      if (w > 0 && h > 0) return { width: w, height: h }
    }

    if (tag === "VP8 " && dataStart + 10 <= dataEnd) {
      // Lossy bitstream: frame tag then 3-byte start code 0x9d 0x01 0x2a
      let i = dataStart
      // Skip optional frame tag (3 bytes) when present
      if (
        dataStart + 13 <= dataEnd &&
        bytes[dataStart + 3] === 0x9d &&
        bytes[dataStart + 4] === 0x01 &&
        bytes[dataStart + 5] === 0x2a
      ) {
        i = dataStart + 3
      } else if (
        bytes[dataStart] === 0x9d &&
        bytes[dataStart + 1] === 0x01 &&
        bytes[dataStart + 2] === 0x2a
      ) {
        i = dataStart
      } else {
        i = -1
      }
      if (i >= 0 && i + 7 <= dataEnd) {
        const w = 1 + (bytes[i + 3]! | ((bytes[i + 4]! & 0x3f) << 8))
        const h = 1 + (bytes[i + 5]! | ((bytes[i + 6]! & 0x3f) << 8))
        if (w > 0 && h > 0) return { width: w, height: h }
      }
    }

    if (tag === "VP8L" && dataStart + 5 <= dataEnd && bytes[dataStart] === 0x2f) {
      const b0 = bytes[dataStart + 1]!
      const b1 = bytes[dataStart + 2]!
      const b2 = bytes[dataStart + 3]!
      const b3 = bytes[dataStart + 4]!
      const w = 1 + (((b1 & 0x3f) << 8) | b0)
      const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
      if (w > 0 && h > 0) return { width: w, height: h }
    }

    offset = dataStart + size + (size & 1) // RIFF pads to even
  }
  return null
}

function readImageSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  // PNG
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  // JPEG
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2
    while (i < bytes.length - 8) {
      if (bytes[i] !== 0xff) {
        i += 1
        continue
      }
      const marker = bytes[i + 1]!
      if (marker === 0xd9 || marker === 0xda) break
      const len = (bytes[i + 2]! << 8) + bytes[i + 3]!
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return {
          height: (bytes[i + 5]! << 8) + bytes[i + 6]!,
          width: (bytes[i + 7]! << 8) + bytes[i + 8]!,
        }
      }
      i += 2 + len
    }
  }
  return readWebpSize(bytes)
}

/** True phone / tablet marketing shot (not icon, badge, or feature strip). */
function isUsableStoreScreenshot(size: {
  width: number
  height: number
}): boolean {
  const { width, height } = size
  const minSide = Math.min(width, height)
  const maxSide = Math.max(width, height)
  if (minSide < 400) return false
  const ar = width / height
  // Near-square → icon / avatar
  if (ar > 0.82 && ar < 1.22) return false
  // Phone portrait (~9:19–9:16) or landscape; reject ultra-wide feature graphics
  if (ar <= 0.72) return maxSide / minSide >= 1.5
  if (ar >= 1.4 && ar <= 2.2) return true
  return false
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== "POST") return textResponse("Method not allowed", 405)

  const auth = req.headers.get("Authorization")
  if (!auth) return textResponse("Unauthorized", 401)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return textResponse("Unauthorized", 401)

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError) {
    return textResponse(profileError.message || "Failed to load profile", 500)
  }
  if (profile?.role !== "admin") {
    return textResponse("Admin only", 403)
  }

  let body: { query?: string; country?: string }
  try {
    body = await req.json()
  } catch {
    return textResponse("Invalid JSON body", 400)
  }

  const query = String(body.query ?? "").trim()
  const country = (String(body.country ?? "us").trim() || "us").toLowerCase()
  if (!query) return textResponse("Query is required", 400)

  let listing: Listing
  try {
    listing = await resolveListing(query, country)
  } catch (err) {
    return textResponse(
      err instanceof Error ? err.message : "Failed to resolve store listing",
      400,
    )
  }

  const urls = listing.screenshotUrls.slice(0, MAX_SCREENSHOTS * 4)
  if (urls.length === 0) {
    return textResponse("No screenshots found for that listing", 400)
  }

  const assetIds: string[] = []
  const keptSizes: Array<{ width: number; height: number }> = []
  const pendingAnalyze: Array<{ bytes: Uint8Array; mime: string }> = []

  for (let i = 0; i < urls.length && assetIds.length < MAX_SCREENSHOTS; i += 1) {
    const url = urls[i]!
    let imgRes: Response
    try {
      imgRes = await fetch(url, { headers: FETCH_HEADERS })
    } catch {
      continue
    }
    if (!imgRes.ok) continue
    const buffer = new Uint8Array(await imgRes.arrayBuffer())
    if (buffer.byteLength < 8_000) continue

    const size = readImageSize(buffer)
    // Must know real pixels — Play WebP icons used to slip through when size was null.
    if (!size || !isUsableStoreScreenshot(size)) continue

    const contentType = (imgRes.headers.get("content-type") || "image/webp")
      .split(";")[0]!
      .trim()
    const mime = mimeFromContentType(contentType)
    const ext = mime.includes("png")
      ? "png"
      : mime.includes("jpeg")
        ? "jpg"
        : "webp"
    const assetId = crypto.randomUUID()
    const path = `${user.id}/${assetId}`
    const { error: uploadError } = await supabase.storage
      .from("project-assets")
      .upload(path, buffer, {
        upsert: true,
        contentType: contentType || mime,
      })
    if (uploadError) {
      console.error("upload failed", uploadError.message)
      continue
    }
    assetIds.push(assetId)
    keptSizes.push(size)
    // Keep bytes for vision — never re-download from Storage.
    pendingAnalyze.push({ bytes: buffer, mime })
  }

  if (assetIds.length === 0) {
    return textResponse(
      "Could not download usable store screenshots (got icons/graphics only). Try an App Store link.",
      502,
    )
  }

  let orientation: Orientation = "portrait"
  const portraitCount = keptSizes.filter((s) => s.height >= s.width * 1.15).length
  const landscapeCount = keptSizes.filter((s) => s.width >= s.height * 1.15).length
  if (landscapeCount > portraitCount) orientation = "landscape"

  let layouts: AnalyzedLayout[] = []
  const openaiKey = Deno.env.get("OPENAI_API_KEY")
  if (openaiKey) {
    try {
      layouts = await analyzeLayoutsFromBytes(openaiKey, pendingAnalyze)
    } catch (err) {
      console.error("batch analyze failed", err)
      layouts = []
    }
  } else {
    console.warn("OPENAI_API_KEY missing — returning import without layouts")
  }

  return jsonResponse({
    title: listing.title,
    description: listing.description.slice(0, 4000),
    subtitle: listing.subtitle,
    store: listing.store,
    orientation,
    assetIds,
    layouts,
  })
})
