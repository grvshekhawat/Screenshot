import {
  createClipart,
  createFrame,
  createLens,
  createSlide,
  createText,
  defaultBackground,
  deviceSpec,
  maxFittingDeviceScale,
  normalizeProject,
  STORE_TARGETS,
} from "./constants"
import type { AnalyzedBox, AnalyzedLayout } from "./api/analyze-store-layout"
import type { ArtboardOrientation } from "./orientation"
import type { DeviceId, Project, StoreTargetId } from "./types"
import { resolveAssetUrls, uploadProjectAsset } from "./api/projects"

function fontFromHint(hint: string): string {
  const h = hint.toLowerCase()
  if (h.includes("serif") || h.includes("playfair")) return "Playfair Display"
  if (h.includes("montserrat")) return "Montserrat"
  if (h.includes("outfit") || h.includes("rounded")) return "Outfit"
  if (h.includes("space") || h.includes("grotesk")) return "Space Grotesk"
  if (h.includes("roboto")) return "Roboto"
  if (h.includes("inter")) return "Inter"
  if (h.includes("poppins")) return "Poppins"
  // Default marketing headline look
  return "Montserrat"
}

function deviceIdFor(
  kind: "iphone" | "pixel" | "ipad",
  orientation: ArtboardOrientation,
  store: "apple" | "google",
): DeviceId {
  const land = orientation === "landscape"
  if (kind === "ipad") return land ? "ipad-13-land" : "ipad-13"
  if (kind === "pixel" || store === "google") {
    return land ? "pixel-land" : "pixel"
  }
  return land ? "iphone-69-land" : "iphone-69"
}

function targetFor(
  store: "apple" | "google",
  orientation: ArtboardOrientation,
): StoreTargetId {
  const land = orientation === "landscape"
  if (store === "google") {
    return land ? "play-phone-landscape" : "play-phone"
  }
  return land ? "iphone-69-landscape" : "iphone-69"
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load screenshot for crop"))
    img.src = url
  })
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** Crop a normalized (0–1) box from an already-loaded image → blob. */
function cropImageElement(
  img: HTMLImageElement,
  box: AnalyzedBox,
  mime: "image/jpeg" | "image/png" = "image/png",
): Promise<Blob> {
  const sx = Math.floor(clamp(box.x, 0, 1) * img.naturalWidth)
  const sy = Math.floor(clamp(box.y, 0, 1) * img.naturalHeight)
  const sw = Math.max(1, Math.floor(clamp(box.w, 0.01, 1) * img.naturalWidth))
  const sh = Math.max(1, Math.floor(clamp(box.h, 0.01, 1) * img.naturalHeight))
  const canvas = document.createElement("canvas")
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext("2d")
  if (!ctx) return Promise.reject(new Error("Canvas unavailable for crop"))
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  const quality = mime === "image/jpeg" ? 0.92 : undefined
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Crop export failed"))),
      mime,
      quality,
    )
  })
}

/** Soft-blurred backdrop from an already-loaded image. */
function blurredBackgroundFromImage(img: HTMLImageElement): Promise<Blob> {
  const w = Math.min(720, img.naturalWidth)
  const h = Math.round((w / img.naturalWidth) * img.naturalHeight)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return Promise.reject(new Error("Canvas unavailable for blur"))
  ctx.filter = "blur(28px) saturate(1.05) brightness(0.92)"
  ctx.drawImage(img, -20, -20, w + 40, h + 40)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Blur export failed"))),
      "image/jpeg",
      0.85,
    )
  })
}

/** @deprecated Prefer cropImageElement with a cached HTMLImageElement. */
export async function cropImageBox(
  sourceUrl: string,
  box: AnalyzedBox,
  mime: "image/jpeg" | "image/png" = "image/png",
): Promise<Blob> {
  const img = await loadImage(sourceUrl)
  return cropImageElement(img, box, mime)
}

function placementFromDeviceBox(
  box: AnalyzedBox,
  deviceId: DeviceId,
  artboardWidth: number,
  artboardHeight: number,
): { x: number; y: number; scale: number } {
  const x = clamp((box.x + box.w / 2) * 100, 0, 100)
  const y = clamp((box.y + box.h / 2) * 100, 0, 100)
  // frame.scale = device width as fraction of artboard width
  const scaleFromWidth = clamp(box.w, 0.25, 1.15)
  const aspect = deviceSpec(deviceId).aspect
  const heightFrac = box.h
  const scaleFromHeight =
    aspect > 0 ? clamp((heightFrac * artboardHeight * aspect) / artboardWidth, 0.25, 1.15) : scaleFromWidth
  // Prefer width match; blend slightly with height so tall thin boxes aren't huge
  let scale = scaleFromWidth * 0.65 + scaleFromHeight * 0.35
  const fit = maxFittingDeviceScale(deviceId, artboardWidth, artboardHeight)
  scale = clamp(scale, 0.35, fit)
  return { x, y, scale }
}

/**
 * Rebuild store marketing screenshots as editable slides:
 * bg (solid / gradient / blurred photo) + text + phones + clipart crops + lenses.
 */
export async function buildProjectFromStoreAnalysis(input: {
  title: string
  store: "apple" | "google"
  orientation: ArtboardOrientation
  assetIds: string[]
  layouts: AnalyzedLayout[]
}): Promise<Project> {
  const orientation =
    input.orientation === "landscape" ? "landscape" : "portrait"
  const targetId = targetFor(input.store, orientation)
  const artboard = STORE_TARGETS[targetId]
  const urls = await resolveAssetUrls(input.assetIds)

  const slides = []

  for (let i = 0; i < input.assetIds.length; i += 1) {
    const sourceAssetId = input.assetIds[i]!
    const layout = input.layouts[i]
    const sourceUrl = urls[sourceAssetId]

    if (!layout || !sourceUrl) {
      slides.push(
        createSlide({
          frames: [],
          texts: [],
          cliparts: [],
          lenses: [],
          selectedId: "",
          background: defaultBackground({
            type: "image",
            colors: ["#000000", "#000000"],
            angle: 180,
            imageId: sourceAssetId,
            imageFit: "cover",
            imageOpacity: 1,
          }),
          templateId: "device-bottom",
        }),
      )
      continue
    }

    let backgroundImageId: string | null = null
    let sourceImg: HTMLImageElement | null = null
    try {
      sourceImg = await loadImage(sourceUrl)
    } catch (err) {
      console.warn("source image load failed", err)
    }

    if (layout.background.type === "photo" && sourceImg) {
      try {
        const blurred = await blurredBackgroundFromImage(sourceImg)
        backgroundImageId = crypto.randomUUID()
        await uploadProjectAsset(backgroundImageId, blurred)
      } catch (err) {
        console.warn("blurred background failed", err)
      }
    }

    const frames = []
    for (const device of layout.devices) {
      const deviceId = deviceIdFor(device.deviceKind, orientation, input.store)
      const box =
        device.deviceBox ??
        ({
          x: ((device.x ?? 50) - 30) / 100,
          y: ((device.y ?? 58) - 35) / 100,
          w: device.scale ?? 0.6,
          h: 0.7,
        } satisfies AnalyzedBox)
      const place = placementFromDeviceBox(
        box,
        deviceId,
        artboard.width,
        artboard.height,
      )

      let screenshotId = sourceAssetId
      const screenBox = device.screenBox
      const isFull =
        screenBox.x <= 0.02 &&
        screenBox.y <= 0.02 &&
        screenBox.w >= 0.96 &&
        screenBox.h >= 0.96
      try {
        if (!isFull && sourceImg) {
          const cropped = await cropImageElement(
            sourceImg,
            screenBox,
            "image/jpeg",
          )
          const cropId = crypto.randomUUID()
          await uploadProjectAsset(cropId, cropped)
          screenshotId = cropId
        }
      } catch (err) {
        console.warn("screen crop failed; using full asset", err)
      }

      frames.push(
        createFrame({
          deviceId,
          screenshotId,
          x: place.x,
          y: place.y,
          scale: place.scale,
          rotation: device.rotation ?? 0,
        }),
      )
    }

    const texts = (layout.texts ?? []).map((t) =>
      createText({
        content: t.content,
        x: t.x,
        y: t.y,
        width: t.width,
        size: t.size,
        color: t.color,
        align: t.align,
        weight: t.weight,
        font: fontFromHint(t.fontHint),
      }),
    )

    const cliparts = []
    for (const clip of layout.cliparts ?? []) {
      if (!sourceImg) break
      try {
        const cropped = await cropImageElement(sourceImg, clip.box, "image/png")
        const assetId = crypto.randomUUID()
        await uploadProjectAsset(assetId, cropped)
        const aspect = clip.box.h > 0 ? clip.box.w / clip.box.h : 1
        cliparts.push(
          createClipart({
            assetId,
            x: (clip.box.x + clip.box.w / 2) * 100,
            y: (clip.box.y + clip.box.h / 2) * 100,
            width: clamp(clip.box.w * 100, 1, 500),
            aspect: aspect > 0 ? aspect : 1,
            recolor: "off",
          }),
        )
      } catch (err) {
        console.warn("clipart crop failed", clip.label, err)
      }
    }

    const lenses = (layout.lenses ?? []).map((l) =>
      createLens({
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        zoom: l.zoom,
        cornerRadius: l.cornerRadius,
        borderColor: l.borderColor,
      }),
    )

    const bgColors =
      layout.background.colors.length >= 2
        ? layout.background.colors
        : [
            layout.background.colors[0] ?? "#111111",
            layout.background.colors[0] ?? "#111111",
          ]

    slides.push(
      createSlide({
        frames,
        texts,
        cliparts,
        lenses,
        selectedId: frames[0]?.id ?? texts[0]?.id ?? "",
        background: defaultBackground({
          type: backgroundImageId
            ? "image"
            : layout.background.type === "gradient"
              ? "gradient"
              : "solid",
          colors: bgColors,
          angle: layout.background.angle,
          imageId: backgroundImageId,
          imageFit: "cover",
          imageOpacity: 1,
        }),
        templateId: "device-bottom",
      }),
    )
  }

  if (slides.length === 0) {
    throw new Error("No screenshots to build a project from")
  }

  return normalizeProject({
    name: input.title.slice(0, 80) || "Imported app",
    targetId,
    designTargetId: targetId,
    sizeEditMode: "current",
    thumbnailLayout: "landscape",
    activeSlideId: slides[0]!.id,
    slides,
    sizeLayouts: {
      [targetId]: {
        slides: structuredClone(slides),
        activeSlideId: slides[0]!.id,
      },
    },
  })
}

/** No-AI fallback: listing creatives as full-bleed slide backgrounds. */
export function buildProjectFromStoreImport(input: {
  title: string
  description: string
  store: "apple" | "google"
  orientation: ArtboardOrientation
  assetIds: string[]
}): Project {
  const orientation =
    input.orientation === "landscape" ? "landscape" : "portrait"
  const isPlay = input.store === "google"

  let targetId: StoreTargetId
  if (orientation === "landscape") {
    targetId = isPlay ? "play-phone-landscape" : "iphone-69-landscape"
  } else {
    targetId = isPlay ? "play-phone" : "iphone-69"
  }

  const slides = input.assetIds.map((assetId) =>
    createSlide({
      frames: [],
      texts: [],
      cliparts: [],
      lenses: [],
      selectedId: "",
      background: defaultBackground({
        type: "image",
        colors: ["#000000", "#000000"],
        angle: 180,
        imageId: assetId,
        imageFit: "cover",
        imageOpacity: 1,
      }),
      templateId: "device-bottom",
    }),
  )

  if (slides.length === 0) {
    throw new Error("No screenshots to build a project from")
  }

  return normalizeProject({
    name: input.title.slice(0, 80) || "Imported app",
    targetId,
    designTargetId: targetId,
    sizeEditMode: "current",
    thumbnailLayout: "landscape",
    activeSlideId: slides[0]!.id,
    slides,
    sizeLayouts: {
      [targetId]: {
        slides: structuredClone(slides),
        activeSlideId: slides[0]!.id,
      },
    },
  })
}
