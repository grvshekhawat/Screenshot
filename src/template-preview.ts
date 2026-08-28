import { STORE_TARGETS, deviceSpec, templateSplit } from "./constants"
import type {
  Frame,
  Project,
  Slide,
  SlideBackground,
  TemplateId,
  ThumbnailLayout,
} from "./types"

const DEFAULT_SLIDE_WIDTH = 420
const MAX_PREVIEW_SLIDES = 5
const SLIDE_GAP = 14
const PAD = 20
const PREVIEW_ENCODE_QUALITY = 0.92

export type PreviewRenderOptions = {
  slideWidth?: number
  /** Override project.thumbnailLayout for this render. */
  layout?: ThumbnailLayout
  /** Resolved asset id → object/data URL for screenshots and backgrounds. */
  assetUrls?: Record<string, string>
}

export function resolveThumbnailLayout(
  project: Project,
  override?: ThumbnailLayout,
): ThumbnailLayout {
  if (override === "portrait" || override === "landscape") return override
  // Landscape artboards use a 2-row grid; portrait artboards use a 1-row strip.
  if (STORE_TARGETS[project.targetId]?.orientation === "landscape") {
    return "landscape"
  }
  return project.thumbnailLayout === "portrait" ? "portrait" : "landscape"
}

/** Tailwind aspect class matching generated thumbnail layout + artboard. */
export function thumbnailAspectClass(
  layout: ThumbnailLayout,
  project?: Project,
): string {
  const landscapeBoard =
    project != null &&
    STORE_TARGETS[project.targetId]?.orientation === "landscape"
  if (landscapeBoard) {
    // 2×2 (or 3×2) grid of landscape slides — closer to square than a strip.
    return "aspect-[16/10]"
  }
  if (layout === "portrait") return "aspect-[10/16]"
  return "aspect-[2.3/1]"
}

function artboardSize(project: Project): { width: number; height: number } {
  const target =
    STORE_TARGETS[project.targetId] ?? STORE_TARGETS["iphone-69"]
  return { width: target.width, height: target.height }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function loadImageMap(
  assetUrls: Record<string, string>,
): Promise<Map<string, HTMLImageElement>> {
  const entries = await Promise.all(
    Object.entries(assetUrls).map(async ([id, url]) => {
      const img = await loadImage(url)
      return img ? ([id, img] as const) : null
    }),
  )
  const map = new Map<string, HTMLImageElement>()
  for (const entry of entries) {
    if (entry) map.set(entry[0], entry[1])
  }
  return map
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: "cover" | "contain",
) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return
  const scale =
    fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  background: SlideBackground,
  width: number,
  height: number,
  templateId: string,
  images: Map<string, HTMLImageElement>,
) {
  const colors = background.colors?.length
    ? background.colors
    : ["#7c3aed", "#db2777"]
  const c0 = colors[0] ?? "#7c3aed"
  const c1 = colors[1] ?? c0

  if (background.type === "image" && background.imageId) {
    const img = images.get(background.imageId)
    if (img) {
      ctx.fillStyle = c0
      ctx.fillRect(0, 0, width, height)
      ctx.save()
      ctx.globalAlpha = Math.min(1, Math.max(0, background.imageOpacity ?? 1))
      drawImageFit(
        ctx,
        img,
        0,
        0,
        width,
        height,
        background.imageFit ?? "cover",
      )
      ctx.restore()
      return
    }
  }

  const split = templateSplit(templateId as TemplateId)
  if (split) {
    const ratio = Math.min(95, Math.max(5, split.ratio)) / 100
    const rad = ((split.angle - 90) * Math.PI) / 180
    const cx = width / 2
    const cy = height / 2
    const len = Math.hypot(width, height)
    const gx0 = cx - Math.cos(rad) * len
    const gy0 = cy - Math.sin(rad) * len
    const gx1 = cx + Math.cos(rad) * len
    const gy1 = cy + Math.sin(rad) * len
    const gradient = ctx.createLinearGradient(gx0, gy0, gx1, gy1)
    gradient.addColorStop(0, c0)
    gradient.addColorStop(Math.max(0.001, ratio - 0.001), c0)
    gradient.addColorStop(ratio, c1)
    gradient.addColorStop(1, c1)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    return
  }

  if (background.type === "solid") {
    ctx.fillStyle = c0
    ctx.fillRect(0, 0, width, height)
    return
  }

  const angle = ((background.angle ?? 165) * Math.PI) / 180
  const x0 = width / 2 - (Math.cos(angle) * width) / 2
  const y0 = height / 2 - (Math.sin(angle) * height) / 2
  const x1 = width / 2 + (Math.cos(angle) * width) / 2
  const y1 = height / 2 + (Math.sin(angle) * height) / 2
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
  gradient.addColorStop(0, c0)
  gradient.addColorStop(1, c1)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function paintFakeChrome(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  screenW: number,
  screenH: number,
) {
  ctx.fillStyle = "rgba(255,255,255,0.12)"
  roundRect(
    ctx,
    screenX + screenW * 0.1,
    screenY + screenH * 0.12,
    screenW * 0.35,
    screenH * 0.02,
    4,
  )
  ctx.fill()
  ctx.fillStyle = "rgba(255,255,255,0.08)"
  roundRect(
    ctx,
    screenX + screenW * 0.1,
    screenY + screenH * 0.2,
    screenW * 0.8,
    screenH * 0.28,
    10,
  )
  ctx.fill()
  roundRect(
    ctx,
    screenX + screenW * 0.1,
    screenY + screenH * 0.54,
    screenW * 0.8,
    screenH * 0.12,
    10,
  )
  ctx.fill()
}

function paintScreenContent(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  screenX: number,
  screenY: number,
  screenW: number,
  screenH: number,
  screenR: number,
  images: Map<string, HTMLImageElement>,
) {
  ctx.save()
  roundRect(ctx, screenX, screenY, screenW, screenH, screenR)
  ctx.clip()

  const imgA = frame.screenshotId
    ? images.get(frame.screenshotId)
    : undefined
  const imgB = frame.screenshotIdB
    ? images.get(frame.screenshotIdB)
    : undefined
  const contain = frame.deviceId.includes("ipad")
  const fit = contain ? "contain" : "cover"

  if (frame.screenMode === "split" && imgA && imgB) {
    drawImageFit(ctx, imgA, screenX, screenY, screenW, screenH, fit)
    const t = Math.min(0.95, Math.max(0.05, (frame.screenSplitRatio ?? 50) / 100))
    const skew = screenW * 0.12
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(screenX + screenW * t + skew, screenY)
    ctx.lineTo(screenX + screenW, screenY)
    ctx.lineTo(screenX + screenW, screenY + screenH)
    ctx.lineTo(screenX + screenW * t - skew, screenY + screenH)
    ctx.closePath()
    ctx.clip()
    drawImageFit(ctx, imgB, screenX, screenY, screenW, screenH, fit)
    ctx.restore()
  } else if (imgA) {
    drawImageFit(ctx, imgA, screenX, screenY, screenW, screenH, fit)
  } else if (imgB) {
    drawImageFit(ctx, imgB, screenX, screenY, screenW, screenH, fit)
  } else {
    paintFakeChrome(ctx, screenX, screenY, screenW, screenH)
  }

  ctx.restore()
}

function paintDevice(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>,
  /** previewSlideWidth / nativeArtboardWidth — keeps shadow in proportion to the slide. */
  designScale = 1,
) {
  const frame = slide.frames[0]
  if (!frame) return
  const spec = deviceSpec(frame.deviceId)
  const deviceW = width * frame.scale
  const deviceH = deviceW / spec.aspect
  const cx = (frame.x / 100) * width
  const cy = (frame.y / 100) * height
  const x = cx - deviceW / 2
  const y = cy - deviceH / 2
  const isLand = String(frame.deviceId).endsWith("-land")
  // Landscape IDs are a rotated portrait phone: proportions are relative to the short side.
  const ref = isLand ? deviceH : deviceW
  const outerR = ref * spec.outerRadius
  const bezel = ref * spec.bezel

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(((frame.rotation ?? 0) * Math.PI) / 180)
  ctx.translate(-cx, -cy)

  const blurPx = Math.min(80, Math.max(0, frame.shadow ?? 24))
  const oxPx = frame.shadowOffsetX ?? 0
  const oyPx =
    frame.shadowOffsetY ?? (blurPx > 0 ? 8 : 0)
  const opacityPct =
    frame.shadowOpacity ??
    (blurPx > 0 || oxPx !== 0 || oyPx !== 0 ? 55 : 0)
  const shadowAlpha = Math.min(1, Math.max(0, opacityPct / 100))
  const shadowBlur = blurPx * designScale
  const shadowOx = oxPx * designScale
  const shadowOy = oyPx * designScale
  if (shadowAlpha > 0 && (blurPx > 0 || oxPx !== 0 || oyPx !== 0)) {
    ctx.save()
    ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`
    ctx.shadowBlur = shadowBlur
    ctx.shadowOffsetX = shadowOx
    ctx.shadowOffsetY = shadowOy
    ctx.fillStyle = spec.color
    roundRect(ctx, x, y, deviceW, deviceH, outerR)
    ctx.fill()
    ctx.restore()
  }

  ctx.fillStyle = spec.color
  roundRect(ctx, x, y, deviceW, deviceH, outerR)
  ctx.fill()

  const screenX = x + bezel
  const screenY = y + bezel
  const screenW = deviceW - bezel * 2
  const screenH = deviceH - bezel * 2
  const screenR = ref * spec.screenRadius
  ctx.fillStyle = "#0a0a0c"
  roundRect(ctx, screenX, screenY, screenW, screenH, screenR)
  ctx.fill()

  paintScreenContent(
    ctx,
    frame,
    screenX,
    screenY,
    screenW,
    screenH,
    screenR,
    images,
  )

  // Camera cutout: portrait = top edge; landscape phone = left edge (rotated chrome).
  if (spec.chrome === "island") {
    const islandLong = ref * 0.264
    const islandShort = ref * 0.078
    const inset = ref * 0.02
    ctx.fillStyle = "#010101"
    if (isLand) {
      roundRect(
        ctx,
        screenX + inset,
        screenY + screenH / 2 - islandLong / 2,
        islandShort,
        islandLong,
        islandShort / 2,
      )
    } else {
      roundRect(
        ctx,
        screenX + screenW / 2 - islandLong / 2,
        screenY + inset,
        islandLong,
        islandShort,
        islandShort / 2,
      )
    }
    ctx.fill()
  } else if (spec.chrome === "punch") {
    const hole = ref * 0.032
    ctx.beginPath()
    if (isLand) {
      ctx.arc(
        screenX + hole * 0.85,
        screenY + screenH / 2,
        hole / 2,
        0,
        Math.PI * 2,
      )
    } else {
      ctx.arc(
        screenX + screenW / 2,
        screenY + hole * 0.85,
        hole / 2,
        0,
        Math.PI * 2,
      )
    }
    ctx.fillStyle = "#0b0f14"
    ctx.fill()
  }

  ctx.restore()
}

function paintTexts(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  width: number,
  height: number,
) {
  for (const text of slide.texts.slice(0, 2)) {
    const content = text.content?.trim()
    if (!content) continue
    const cx = (text.x / 100) * width
    const cy = (text.y / 100) * height
    const fontSize = Math.max(12, (text.size / 1000) * width * 0.85)
    ctx.save()
    ctx.fillStyle = text.color || "#ffffff"
    ctx.textAlign =
      text.align === "left"
        ? "left"
        : text.align === "right"
          ? "right"
          : "center"
    ctx.textBaseline = "middle"
    ctx.font = `600 ${fontSize}px ${text.font || "system-ui"}, system-ui, sans-serif`
    const maxWidth = width * 0.82
    const words = content.split(/\s+/)
    const lines: string[] = []
    let line = ""
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
    const lineHeight = fontSize * 1.15
    const startY = cy - ((lines.length - 1) * lineHeight) / 2
    lines.slice(0, 3).forEach((entry, index) => {
      ctx.fillText(entry, cx, startY + index * lineHeight, maxWidth)
    })
    ctx.restore()
  }
}

function paintSlide(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>,
  designScale = 1,
) {
  paintBackground(ctx, slide.background, width, height, slide.templateId, images)
  paintDevice(ctx, slide, width, height, images, designScale)
  paintTexts(ctx, slide, width, height)
}

function previewSlides(project: Project): Slide[] {
  const landscapeBoard =
    STORE_TARGETS[project.targetId]?.orientation === "landscape"
  // Landscape gallery uses a 2-row grid — 4 slides (2×2) matches App Store sets.
  const max = landscapeBoard ? 4 : MAX_PREVIEW_SLIDES
  const count = Math.min(max, Math.max(1, project.slides.length))
  return project.slides.slice(0, count)
}

/**
 * Catalog / project thumbnail: up to 5 slides.
 * Portrait artboards → 1-row strip.
 * Landscape artboards → 2-row grid (2×2 or 3+2), like App Store landscape sets.
 */
export async function renderProjectPreviewCanvas(
  project: Project,
  options: PreviewRenderOptions = {},
): Promise<HTMLCanvasElement> {
  const layout = resolveThumbnailLayout(project, options.layout)
  const landscapeBoard =
    STORE_TARGETS[project.targetId]?.orientation === "landscape"
  const slideWidth =
    options.slideWidth ??
    (landscapeBoard ? Math.round(DEFAULT_SLIDE_WIDTH * 1.55) : DEFAULT_SLIDE_WIDTH)
  const images = await loadImageMap(options.assetUrls ?? {})
  const { width: artW, height: artH } = artboardSize(project)
  const slides = previewSlides(project)
  const slideH = Math.max(1, Math.round(slideWidth * (artH / artW)))
  // Shadow / stroke values are authored in native artboard px — scale to preview.
  const designScale = slideWidth / Math.max(1, artW)

  // Landscape → 2-row grid; portrait stack; else 1-row strip.
  const useLandGrid = landscapeBoard && layout !== "portrait"
  const cols = useLandGrid
    ? 2
    : layout === "portrait"
      ? 1
      : Math.max(1, slides.length)
  const rows = useLandGrid
    ? Math.min(2, Math.max(1, Math.ceil(slides.length / 2)))
    : layout === "portrait"
      ? Math.max(1, slides.length)
      : 1

  const width =
    PAD * 2 + cols * slideWidth + Math.max(0, cols - 1) * SLIDE_GAP
  const height =
    PAD * 2 + rows * slideH + Math.max(0, rows - 1) * SLIDE_GAP

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  ctx.fillStyle = "#09090b"
  ctx.fillRect(0, 0, width, height)

  if (!slides.length) return canvas

  slides.forEach((slide, index) => {
    let col: number
    let row: number
    if (useLandGrid) {
      row = Math.floor(index / cols)
      col = index % cols
      const rowStart = row * cols
      const inRow = Math.min(cols, slides.length - rowStart)
      if (inRow < cols) {
        col = index - rowStart
        const offset = ((cols - inRow) * (slideWidth + SLIDE_GAP)) / 2
        const x = PAD + offset + col * (slideWidth + SLIDE_GAP)
        const y = PAD + row * (slideH + SLIDE_GAP)
        paintPreviewCell(ctx, slide, x, y, slideWidth, slideH, images, designScale)
        return
      }
    } else if (layout === "portrait") {
      col = 0
      row = index
    } else {
      col = index
      row = 0
    }
    const x = PAD + col * (slideWidth + SLIDE_GAP)
    const y = PAD + row * (slideH + SLIDE_GAP)
    paintPreviewCell(ctx, slide, x, y, slideWidth, slideH, images, designScale)
  })

  return canvas
}

function paintPreviewCell(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  x: number,
  y: number,
  slideWidth: number,
  slideH: number,
  images: Map<string, HTMLImageElement>,
  designScale = 1,
) {
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, x, y, slideWidth, slideH, 10)
  ctx.clip()
  ctx.translate(x, y)
  paintSlide(ctx, slide, slideWidth, slideH, images, designScale)
  ctx.restore()

  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  roundRect(ctx, x + 0.5, y + 0.5, slideWidth - 1, slideH - 1, 10)
  ctx.stroke()
}

/** @deprecated Prefer renderProjectPreviewCanvas — same multi-slide strip. */
export async function renderTemplatePreviewCanvas(
  project: Project,
  options: PreviewRenderOptions | number = {},
): Promise<HTMLCanvasElement> {
  const opts =
    typeof options === "number" ? { slideWidth: options } : options
  return renderProjectPreviewCanvas(project, opts)
}

export async function renderProjectPreviewDataUrl(
  project: Project,
  options: PreviewRenderOptions | number = {},
): Promise<string> {
  const opts =
    typeof options === "number" ? { slideWidth: options } : options
  const canvas = await renderProjectPreviewCanvas(project, opts)
  try {
    return canvas.toDataURL("image/webp", PREVIEW_ENCODE_QUALITY)
  } catch {
    return canvas.toDataURL("image/jpeg", PREVIEW_ENCODE_QUALITY)
  }
}

export async function renderTemplatePreviewDataUrl(
  project: Project,
  options: PreviewRenderOptions | number = {},
): Promise<string> {
  return renderProjectPreviewDataUrl(project, options)
}

export async function renderProjectPreviewBlob(
  project: Project,
  options: PreviewRenderOptions | number = {},
): Promise<Blob> {
  const opts =
    typeof options === "number" ? { slideWidth: options } : options
  const canvas = await renderProjectPreviewCanvas(project, opts)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (result) => resolve(result),
      "image/webp",
      PREVIEW_ENCODE_QUALITY,
    )
  })
  if (blob) return blob
  const fallback = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (result) => resolve(result),
      "image/jpeg",
      PREVIEW_ENCODE_QUALITY,
    )
  })
  if (!fallback) throw new Error("Could not encode project preview")
  return fallback
}

export async function renderTemplatePreviewBlob(
  project: Project,
  options: PreviewRenderOptions | number = {},
): Promise<Blob> {
  return renderProjectPreviewBlob(project, options)
}
