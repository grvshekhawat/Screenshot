/** Shared store-screenshot → editable layout vision analysis (gpt-4o). */

const MODEL = "gpt-4o"

const SYSTEM_PROMPT = `You reverse-engineer ONE App Store / Play marketing screenshot into editable Screenshot Studio layers.

The source image IS the artboard (same aspect). Measure carefully — placement must match the image.

Return ONLY JSON:
{
  "background": {
    "type": "solid" | "gradient" | "photo",
    "colors": ["#rrggbb", "#rrggbb"],
    "angle": number
  },
  "texts": [
    {
      "content": string,
      "x": number,
      "y": number,
      "width": number,
      "size": number,
      "color": "#rrggbb",
      "align": "left" | "center" | "right",
      "weight": 400 | 500 | 600 | 700 | 800 | 900,
      "fontHint": "montserrat" | "poppins" | "outfit" | "space" | "serif" | "sans"
    }
  ],
  "devices": [
    {
      "deviceBox": { "x": number, "y": number, "w": number, "h": number },
      "screenBox": { "x": number, "y": number, "w": number, "h": number },
      "rotation": number,
      "deviceKind": "iphone" | "pixel" | "ipad"
    }
  ],
  "cliparts": [
    {
      "box": { "x": number, "y": number, "w": number, "h": number },
      "label": string
    }
  ],
  "lenses": [],
  "notes": string
}

RULES:
1) All boxes are normalized 0–1 relative to the SOURCE IMAGE (x,y = top-left; w,h = size).
2) deviceBox = full phone including bezel/frame as drawn in the creative.
3) screenBox = ONLY the app UI pixels inside the glass (no bezel, no marketing text, no stars/trophy outside the phone). Tight crop.
4) texts = marketing copy OUTSIDE the phone only (headlines, subheads, review counts, quotes). Do NOT duplicate the same phrase at two sizes. Max 4. size = approximate capital height in px if the image width were 1080 (big headlines often 52–78; sublines 22–36; tiny badges 14–20). x/y = center of the text block as % of artboard (0–100). width = text box width as % (70–94 typical).
5) cliparts = decorative graphics OUTSIDE the phone: stars, laurel wreaths, trophies, badges, sunbursts, logos (not the phone, not UI). Each box tightly around one graphic. Max 6. Skip tiny noise.
6) background.type = "photo" when there is a photo/blurred scene/texture behind the phone; "solid" for flat color; "gradient" for clear two-tone blend. Always fill colors with 1–2 dominant backdrop colors.
7) fontHint: bold all-caps geometric → "montserrat"; friendly rounded → "outfit"/"poppins"; tech → "space"; editorial → "serif".
8) Prefer Android "pixel" for Play-style hole-punch frames; "iphone" for Dynamic Island / notch iPhone chrome.
9) Ignore store website chrome. Focus on the creative.`

type Box = { x: number; y: number; w: number; h: number }

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
    deviceBox: Box
    screenBox: Box
    rotation: number
    deviceKind: "iphone" | "pixel" | "ipad"
  }>
  cliparts: Array<{
    box: Box
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

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function hexColor(value: unknown, fallback = "#111111"): string {
  const s = String(value ?? "").trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1]!
    const g = s[2]!
    const b = s[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}

function normalizeBox(raw: unknown): Box {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  let x = clamp(Number(o.x), 0, 1)
  let y = clamp(Number(o.y), 0, 1)
  let w = clamp(Number(o.w), 0.02, 1)
  let h = clamp(Number(o.h), 0.02, 1)
  if (x + w > 1) w = Math.max(0.02, 1 - x)
  if (y + h > 1) h = Math.max(0.02, 1 - y)
  return { x, y, w, h }
}

function textKey(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function dedupeTexts<T extends { content: string; size: number }>(
  texts: T[],
): T[] {
  const sorted = [...texts].sort((a, b) => b.size - a.size)
  const kept: T[] = []
  for (const t of sorted) {
    const key = textKey(t.content)
    if (!key) continue
    const dup = kept.some((k) => {
      const kk = textKey(k.content)
      return kk === key || kk.includes(key) || key.includes(kk)
    })
    if (!dup) kept.push(t)
  }
  return kept.slice(0, 4)
}

function normalizeLayout(raw: unknown): AnalyzedLayout {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const bg = (o.background && typeof o.background === "object"
    ? o.background
    : {}) as Record<string, unknown>
  const colorsRaw = Array.isArray(bg.colors) ? bg.colors : ["#111111", "#222222"]
  const colors = colorsRaw.map((c) => hexColor(c)).slice(0, 3)
  if (colors.length === 0) colors.push("#111111")
  if (colors.length === 1) colors.push(colors[0]!)

  const bgType =
    bg.type === "photo" || bg.type === "image"
      ? "photo"
      : bg.type === "gradient"
        ? "gradient"
        : "solid"

  const textsIn = Array.isArray(o.texts) ? o.texts : []
  const devicesIn = Array.isArray(o.devices) ? o.devices : []
  const clipartsIn = Array.isArray(o.cliparts) ? o.cliparts : []
  const lensesIn = Array.isArray(o.lenses) ? o.lenses : []

  const texts = dedupeTexts(
    textsIn
      .slice(0, 6)
      .map((t) => {
        const row = (t && typeof t === "object" ? t : {}) as Record<
          string,
          unknown
        >
        const align =
          row.align === "left" || row.align === "right" ? row.align : "center"
        return {
          content: String(row.content ?? "").trim().slice(0, 160),
          x: clamp(Number(row.x), 0, 100),
          y: clamp(Number(row.y), 0, 100),
          width: clamp(Number(row.width) || 86, 20, 100),
          size: clamp(Number(row.size) || 56, 12, 140),
          color: hexColor(row.color, "#ffffff"),
          align: align as "left" | "center" | "right",
          weight: clamp(Number(row.weight) || 700, 400, 900),
          fontHint: String(row.fontHint ?? "montserrat"),
        }
      })
      .filter((t) => t.content.length > 0),
  )

  const devices = devicesIn.slice(0, 2).map((d) => {
    const row = (d && typeof d === "object" ? d : {}) as Record<string, unknown>
    const kind = String(row.deviceKind ?? "pixel").toLowerCase()
    const deviceKind =
      kind === "iphone" || kind === "ios"
        ? "iphone"
        : kind === "ipad" || kind === "tablet"
          ? "ipad"
          : "pixel"
    const deviceBox = normalizeBox(row.deviceBox ?? row.frameBox)
    let screenBox = normalizeBox(row.screenBox)
    if (screenBox.w > 0.95 && screenBox.h > 0.95 && deviceBox.w < 0.95) {
      screenBox = {
        x: deviceBox.x + deviceBox.w * 0.06,
        y: deviceBox.y + deviceBox.h * 0.03,
        w: deviceBox.w * 0.88,
        h: deviceBox.h * 0.94,
      }
    }
    return {
      deviceBox,
      screenBox,
      rotation: clamp(Number(row.rotation) || 0, -30, 30),
      deviceKind: deviceKind as "iphone" | "pixel" | "ipad",
    }
  })

  if (devices.length === 0) {
    devices.push({
      deviceBox: { x: 0.18, y: 0.28, w: 0.64, h: 0.68 },
      screenBox: { x: 0.22, y: 0.31, w: 0.56, h: 0.62 },
      rotation: 0,
      deviceKind: "pixel",
    })
  }

  const cliparts = clipartsIn
    .slice(0, 6)
    .map((c) => {
      const row = (c && typeof c === "object" ? c : {}) as Record<string, unknown>
      return {
        box: normalizeBox(row.box ?? row),
        label: String(row.label ?? "decor").slice(0, 40),
      }
    })
    .filter((c) => c.box.w * c.box.h >= 0.0015)

  const lenses = lensesIn.slice(0, 2).map((l) => {
    const row = (l && typeof l === "object" ? l : {}) as Record<string, unknown>
    return {
      x: clamp(Number(row.x) || 50, 0, 100),
      y: clamp(Number(row.y) || 40, 0, 100),
      width: clamp(Number(row.width) || 36, 8, 80),
      height: clamp(Number(row.height) || 28, 8, 80),
      zoom: clamp(Number(row.zoom) || 2, 1.25, 4),
      cornerRadius: clamp(Number(row.cornerRadius) ?? 50, 0, 50),
      borderColor: hexColor(row.borderColor, "#ffffff"),
    }
  })

  return {
    background: {
      type: bgType,
      colors,
      angle: clamp(Number(bg.angle) || 180, 0, 360),
    },
    texts,
    devices,
    cliparts,
    lenses,
    notes: String(o.notes ?? "").slice(0, 400),
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function mimeFromContentType(fallback: string): string {
  if (fallback.includes("png")) return "image/png"
  if (fallback.includes("webp")) return "image/webp"
  return "image/jpeg"
}

export function fallbackLayout(): AnalyzedLayout {
  return {
    background: {
      type: "solid",
      colors: ["#0f172a", "#0f172a"],
      angle: 180,
    },
    texts: [],
    devices: [
      {
        deviceBox: { x: 0.18, y: 0.28, w: 0.64, h: 0.68 },
        screenBox: { x: 0.22, y: 0.31, w: 0.56, h: 0.62 },
        rotation: 0,
        deviceKind: "pixel",
      },
    ],
    cliparts: [],
    lenses: [],
    notes: "fallback",
  }
}

/** Analyze image bytes already in memory (no Storage download). */
export async function analyzeLayoutFromBytes(
  openaiKey: string,
  imageBytes: Uint8Array,
  mime: string,
): Promise<AnalyzedLayout> {
  const b64 = bytesToBase64(imageBytes)
  const dataUrl = `data:${mime};base64,${b64}`

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Measure this marketing screenshot and return the JSON layout. Be precise with deviceBox/screenBox/clipart boxes and text x/y/size.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
          ],
        },
      ],
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    console.error("OpenAI vision error:", openaiRes.status, errText)
    let message = "Layout analysis failed"
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      if (errText) message = errText.slice(0, 300)
    }
    throw new Error(message)
  }

  const result = (await openaiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = result.choices?.[0]?.message?.content
  if (!content) throw new Error("Empty vision response")

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error("Vision returned non-JSON layout")
  }
  return normalizeLayout(parsed)
}

/** Analyze many images in parallel; failures become fallbackLayout. */
export async function analyzeLayoutsFromBytes(
  openaiKey: string,
  items: Array<{ bytes: Uint8Array; mime: string }>,
): Promise<AnalyzedLayout[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        return await analyzeLayoutFromBytes(openaiKey, item.bytes, item.mime)
      } catch (err) {
        console.error("analyze failed", err)
        return fallbackLayout()
      }
    }),
  )
}
