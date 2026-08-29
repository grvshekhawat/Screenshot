import { domToCanvas } from "modern-screenshot"

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

  return domToCanvas(artboard, {
    width,
    height,
    scale: 1,
    backgroundColor: null,
    font: {},
    fetchFn: fetchAsset,
  })
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
