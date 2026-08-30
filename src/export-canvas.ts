import { domToCanvas } from "modern-screenshot"
import { FONTS } from "./constants"

export async function blobUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Failed to read asset"))
    }
    reader.onerror = () => reject(new Error("Failed to read asset"))
    reader.readAsDataURL(blob)
  })
}

async function fetchAsset(url: string): Promise<string | false> {
  if (url.startsWith("blob:") || url.startsWith("http")) {
    try {
      return await blobUrlToDataUrl(url)
    } catch {
      return false
    }
  }
  return false
}

async function inlineImages(root: HTMLElement) {
  await Promise.all(
    [...root.querySelectorAll("img")].map(async (img) => {
      const src = img.currentSrc || img.src
      if (!src || src.startsWith("data:")) return
      try {
        img.src = await blobUrlToDataUrl(src)
        await img.decode()
      } catch {
        /* ignore */
      }
    }),
  )
}

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&family=Inter:wght@400;600;700&family=Lato:wght@400;700&family=Montserrat:wght@500;600;700&family=Open+Sans:wght@400;600;700&family=Outfit:wght@500;600;700&family=Playfair+Display:wght@600;700&family=Poppins:wght@500;600;700&family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@500;600;700&display=swap"

let cachedFontCss: string | null | undefined

async function inlineCssUrls(css: string, baseHref: string): Promise<string> {
  const urlMatches = [...css.matchAll(/url\(([^)]+)\)/g)]
  let next = css
  // Replace longer matches first so partial overlaps don't break data URLs.
  const unique = [...new Set(urlMatches.map((match) => match[0]))].sort(
    (a, b) => b.length - a.length,
  )
  for (const token of unique) {
    const raw = token
      .slice(4, -1)
      .trim()
      .replace(/^['"]|['"]$/g, "")
    if (raw.startsWith("data:")) continue
    const absolute = new URL(raw, baseHref).href
    try {
      const fontRes = await fetch(absolute, {
        mode: "cors",
        credentials: "omit",
      })
      if (!fontRes.ok) continue
      const blob = await fontRes.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result)
          else reject(new Error("font read failed"))
        }
        reader.onerror = () => reject(new Error("font read failed"))
        reader.readAsDataURL(blob)
      })
      next = next.split(token).join(`url("${dataUrl}")`)
    } catch {
      /* keep remote url */
    }
  }
  return next
}

/**
 * Self-contained @font-face CSS for modern-screenshot.
 * When `cssText` is set, the library uses only that CSS — every url() must be
 * inlined or fonts fall back to serif.
 */
async function editorFontCssText(): Promise<string | undefined> {
  if (cachedFontCss !== undefined) return cachedFontCss ?? undefined
  try {
    await document.fonts.ready
    await Promise.all(
      FONTS.flatMap((family) => [
        document.fonts.load(`500 48px "${family}"`).catch(() => undefined),
        document.fonts.load(`600 48px "${family}"`).catch(() => undefined),
        document.fonts.load(`700 48px "${family}"`).catch(() => undefined),
      ]),
    )

    // Prefer stylesheets already in the document (CORS + crossOrigin on <link>).
    const fromDom: string[] = []
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSFontFaceRule) {
          fromDom.push(rule.cssText)
        }
      }
    }
    if (fromDom.length > 0) {
      const href =
        Array.from(document.styleSheets).find((sheet) =>
          String(sheet.href || "").includes("fonts.googleapis.com"),
        )?.href || GOOGLE_FONTS_HREF
      const inlined = await inlineCssUrls(fromDom.join("\n"), href)
      if (inlined.includes("@font-face") && inlined.includes("data:")) {
        cachedFontCss = inlined
        return inlined
      }
    }

    const response = await fetch(GOOGLE_FONTS_HREF, {
      mode: "cors",
      credentials: "omit",
    })
    if (!response.ok) {
      cachedFontCss = null
      return undefined
    }
    const css = await response.text()
    const inlined = await inlineCssUrls(css, GOOGLE_FONTS_HREF)
    if (!inlined.includes("@font-face")) {
      cachedFontCss = null
      return undefined
    }
    cachedFontCss = inlined
    return inlined
  } catch {
    cachedFontCss = null
    return undefined
  }
}

/** Capture the artboard div exactly as rendered — same idea as html2canvas. */
export async function captureArtboardDom(
  artboard: HTMLElement,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  for (const el of [artboard, ...artboard.querySelectorAll("*")]) {
    if (el instanceof HTMLElement) el.style.outline = "none"
  }

  await inlineImages(artboard)
  await document.fonts.ready.catch(() => undefined)
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))

  const cssText = await editorFontCssText()
  let injected: HTMLStyleElement | null = null
  if (cssText) {
    injected = document.createElement("style")
    injected.setAttribute("data-export-fonts", "true")
    injected.textContent = cssText
    artboard.prepend(injected)
  }

  try {
    return await domToCanvas(artboard, {
      width,
      height,
      scale: 1,
      backgroundColor: null,
      // Do not set preferredFormat when cssText is provided — it filters out
      // non-woff2 faces Google may return for this UA and drops the fonts.
      font: cssText ? { cssText } : {},
      fetchFn: fetchAsset,
    })
  } finally {
    injected?.remove()
  }
}

export function canvasToOpaquePng(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  options?: { watermark?: boolean },
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      reject(new Error("Could not create canvas"))
      return
    }
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(source, 0, 0, width, height)
    if (options?.watermark) drawWatermark(ctx, width, height)
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Failed to encode PNG"))
    }, "image/png")
  })
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const label = "Screenshot Studio"
  const fontSize = Math.max(18, Math.round(width * 0.038))
  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 7)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`
  ctx.lineWidth = Math.max(2, fontSize * 0.08)
  ctx.strokeStyle = "rgba(0,0,0,0.22)"
  ctx.fillStyle = "rgba(255,255,255,0.38)"
  for (let y = -height; y <= height; y += fontSize * 3.2) {
    for (let x = -width; x <= width; x += fontSize * 7.5) {
      ctx.strokeText(label, x, y)
      ctx.fillText(label, x, y)
    }
  }
  ctx.restore()

  const badgeH = Math.max(36, Math.round(height * 0.028))
  const pad = Math.round(badgeH * 0.35)
  ctx.font = `600 ${Math.round(badgeH * 0.45)}px Inter, system-ui, sans-serif`
  const badge = "Free preview · Upgrade for clean export"
  const textW = ctx.measureText(badge).width
  const badgeW = textW + pad * 2
  const x = width - badgeW - Math.round(width * 0.03)
  const y = height - badgeH - Math.round(height * 0.02)
  ctx.fillStyle = "rgba(9,9,11,0.72)"
  ctx.beginPath()
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, badgeW, badgeH, badgeH / 2)
  } else {
    const r = badgeH / 2
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + badgeW, y, x + badgeW, y + badgeH, r)
    ctx.arcTo(x + badgeW, y + badgeH, x, y + badgeH, r)
    ctx.arcTo(x, y + badgeH, x, y, r)
    ctx.arcTo(x, y, x + badgeW, y, r)
    ctx.closePath()
  }
  ctx.fill()
  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(badge, x + pad, y + badgeH / 2)
}
