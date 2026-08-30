import { useEffect, useState } from "react"
import { clipartDropShadowCss } from "../constants"
import type { ClipartLayer } from "../types"

function cssUrl(url: string): string {
  return `url(${JSON.stringify(url)})`
}

function bakeRecoloredClipart(
  imageUrl: string,
  clipart: ClipartLayer,
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    if (imageUrl.startsWith("http")) img.crossOrigin = "anonymous"
    img.onload = () => {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      if (!w || !h) {
        resolve(null)
        return
      }
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(null)
        return
      }
      const recolor = clipart.recolor ?? "off"
      const color = clipart.color ?? "#fbbf24"
      const color2 = clipart.color2 ?? "#f97316"
      const colorAngle =
        typeof clipart.colorAngle === "number" ? clipart.colorAngle : 135
      if (recolor === "gradient") {
        const rad = ((colorAngle - 90) * Math.PI) / 180
        const cx = w / 2
        const cy = h / 2
        const len = Math.hypot(w, h) / 2
        const gradient = ctx.createLinearGradient(
          cx - Math.cos(rad) * len,
          cy - Math.sin(rad) * len,
          cx + Math.cos(rad) * len,
          cy + Math.sin(rad) * len,
        )
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, color2)
        ctx.fillStyle = gradient
      } else {
        ctx.fillStyle = color
      }
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = "destination-in"
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL("image/png"))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}

/** Shared paint for clipart image + recolor / opacity / shadow. */
export function ClipartVisual({
  clipart,
  imageUrl,
  forExport = false,
}: {
  clipart: ClipartLayer
  imageUrl: string | null
  /** Prefer canvas-baked recolor so DOM capture / thumbnails keep the silhouette. */
  forExport?: boolean
}) {
  const recolor = clipart.recolor ?? "off"
  const [bakedUrl, setBakedUrl] = useState<string | null>(null)
  const [bakeDone, setBakeDone] = useState(recolor === "off")

  useEffect(() => {
    if (!imageUrl || recolor === "off") {
      setBakedUrl(null)
      setBakeDone(true)
      return
    }
    let cancelled = false
    setBakeDone(false)
    void bakeRecoloredClipart(imageUrl, clipart).then((url) => {
      if (cancelled) return
      setBakedUrl(url)
      setBakeDone(true)
    })
    return () => {
      cancelled = true
    }
  }, [
    imageUrl,
    recolor,
    clipart.color,
    clipart.color2,
    clipart.colorAngle,
  ])

  if (!imageUrl) return null

  const opacity =
    typeof clipart.opacity === "number" && Number.isFinite(clipart.opacity)
      ? Math.min(1, Math.max(0, clipart.opacity))
      : 1
  const blur =
    typeof clipart.blur === "number" && clipart.blur > 0
      ? Math.min(48, clipart.blur)
      : 0
  const color = clipart.color ?? "#fbbf24"
  const color2 = clipart.color2 ?? "#f97316"
  const colorAngle =
    typeof clipart.colorAngle === "number" ? clipart.colorAngle : 135

  const filters: string[] = []
  if (blur > 0) filters.push(`blur(${blur}px)`)
  const dropShadow = clipartDropShadowCss(clipart)
  if (dropShadow) filters.push(dropShadow)
  const filter = filters.length > 0 ? filters.join(" ") : undefined

  const src = recolor === "off" ? imageUrl : bakedUrl

  // Export / thumbnail capture: always use an <img> (CSS mask-image is dropped by
  // modern-screenshot). Signal bake-in-progress so capture can wait.
  if (forExport) {
    if (recolor !== "off" && !bakeDone) {
      return (
        <div
          data-clipart-baking=""
          aria-hidden
          style={{ width: "100%", height: "100%" }}
        />
      )
    }
    if (!src) return null
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        crossOrigin={src.startsWith("http") ? "anonymous" : undefined}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "fill",
          opacity,
          filter,
          pointerEvents: "none",
        }}
      />
    )
  }

  if (recolor === "off") {
    return (
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        crossOrigin={imageUrl.startsWith("http") ? "anonymous" : undefined}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "fill",
          opacity,
          filter,
          pointerEvents: "none",
        }}
      />
    )
  }

  // Live editor: baked img when ready (capture-safe), CSS mask while baking.
  if (bakedUrl) {
    return (
      <img
        src={bakedUrl}
        alt=""
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "fill",
          opacity,
          filter,
          pointerEvents: "none",
        }}
      />
    )
  }

  const background =
    recolor === "gradient"
      ? `linear-gradient(${colorAngle}deg, ${color}, ${color2})`
      : color
  const mask = cssUrl(imageUrl)

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        opacity,
        background,
        filter,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        pointerEvents: "none",
      }}
    />
  )
}
