import { DEVICES, STORE_TARGETS, deviceSpec, CLIPART_WIDTH_MIN, CLIPART_WIDTH_MAX } from "./constants"
import type {
  ClipartLayer,
  DeviceId,
  Frame,
  LensLayer,
  Project,
  Slide,
  StoreTargetId,
  TextLayer,
} from "./types"

/** Native chrome for each store size. */
export function deviceForExportTarget(
  _sourceDeviceId: DeviceId,
  _fromTargetId: StoreTargetId,
  toTargetId: StoreTargetId,
): DeviceId {
  if (toTargetId === "play-phone") return "pixel"
  if (toTargetId === "play-phone-landscape") return "pixel-land"
  if (toTargetId === "ipad-13-landscape") return "ipad-13-land"
  if (toTargetId === "ipad-11-landscape") return "ipad-11-land"
  if (toTargetId === "ipad-13") return "ipad-13"
  if (toTargetId === "ipad-11") return "ipad-11"
  if (
    toTargetId === "iphone-69-landscape" ||
    toTargetId === "iphone-65-landscape" ||
    toTargetId === "iphone-63-landscape"
  ) {
    return "iphone-69-land"
  }
  return "iphone-69"
}

export function isIpadStoreTarget(targetId: StoreTargetId): boolean {
  return (
    targetId === "ipad-13" ||
    targetId === "ipad-11" ||
    targetId === "ipad-13-landscape" ||
    targetId === "ipad-11-landscape"
  )
}

export function isLandscapeStoreTarget(targetId: StoreTargetId): boolean {
  return STORE_TARGETS[targetId]?.orientation === "landscape"
}

function artboardAspect(targetId: StoreTargetId): number {
  const size = STORE_TARGETS[targetId]
  return size.width / size.height
}

function deviceFootprintPx(
  frame: Frame,
  targetId: StoreTargetId,
): { widthPx: number; heightPx: number; cxPx: number; cyPx: number } {
  const size = STORE_TARGETS[targetId]
  const aspect = deviceSpec(frame.deviceId).aspect
  const widthPx = size.width * frame.scale
  const heightPx = widthPx / aspect
  return {
    widthPx,
    heightPx,
    cxPx: (frame.x / 100) * size.width,
    cyPx: (frame.y / 100) * size.height,
  }
}

function nearestFrame(lens: LensLayer, frames: Frame[]): Frame | null {
  if (!frames.length) return null
  let best = frames[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const frame of frames) {
    const dist =
      (frame.x - lens.x) * (frame.x - lens.x) +
      (frame.y - lens.y) * (frame.y - lens.y)
    if (dist < bestDist) {
      best = frame
      bestDist = dist
    }
  }
  return best
}

/**
 * Keep the phone’s height footprint on the artboard, swap chrome when needed,
 * and leave headroom for headlines.
 */
export function adaptFrameToStoreTarget(
  frame: Frame,
  fromTargetId: StoreTargetId,
  toTargetId: StoreTargetId,
): Frame {
  if (fromTargetId === toTargetId) return frame

  const fromDevice = deviceSpec(frame.deviceId)
  const toDeviceId = deviceForExportTarget(
    frame.deviceId,
    fromTargetId,
    toTargetId,
  )
  const toDevice = DEVICES[toDeviceId]
  const fromArt = artboardAspect(fromTargetId)
  const toArt = artboardAspect(toTargetId)

  const heightFrac = (frame.scale / fromDevice.aspect) * fromArt
  let scale = (heightFrac * toDevice.aspect) / toArt

  const headroom = isIpadStoreTarget(toTargetId) ? 0.84 : 0.9
  const maxByHeight = (headroom * toDevice.aspect) / toArt
  const maxByWidth = isIpadStoreTarget(toTargetId) ? 0.88 : 0.9
  scale = Math.min(Math.max(0.2, scale), maxByHeight, maxByWidth)

  const halfHeightPct = ((scale / toDevice.aspect) * toArt * 100) / 2
  const topReserve = isIpadStoreTarget(toTargetId) ? 16 : 14
  const pad = 3
  const minY = Math.max(halfHeightPct + pad, topReserve + halfHeightPct * 0.3)
  const maxY = 100 - halfHeightPct - pad
  const y = maxY > minY ? Math.min(maxY, Math.max(minY, frame.y)) : 55

  return {
    ...frame,
    deviceId: toDeviceId,
    scale,
    y,
  }
}

/** Keep text height similar relative to the artboard. */
export function adaptTextToStoreTarget(
  text: TextLayer,
  fromTargetId: StoreTargetId,
  toTargetId: StoreTargetId,
): TextLayer {
  if (fromTargetId === toTargetId) return text
  const fromArt = artboardAspect(fromTargetId)
  const toArt = artboardAspect(toTargetId)
  const size = Math.round(Math.max(1, text.size * (fromArt / toArt)))
  let y = text.y
  if (isIpadStoreTarget(toTargetId) && text.y < 28) {
    y = Math.max(6, text.y * 0.85)
  }
  return { ...text, size, y }
}

/**
 * Scale lens in device pixel space so the same on-screen region is magnified.
 * Clears locked snapshots — those were captured at the source artboard size.
 */
export function adaptLensToStoreTarget(
  lens: LensLayer,
  fromFrame: Frame | null,
  toFrame: Frame | null,
  fromTargetId: StoreTargetId,
  toTargetId: StoreTargetId,
): LensLayer {
  if (fromTargetId === toTargetId) return lens

  const fromSize = STORE_TARGETS[fromTargetId]
  const toSize = STORE_TARGETS[toTargetId]
  const fromFp = fromFrame
    ? deviceFootprintPx(fromFrame, fromTargetId)
    : {
        widthPx: fromSize.width * 0.7,
        heightPx: fromSize.height * 0.5,
        cxPx: fromSize.width * 0.5,
        cyPx: fromSize.height * 0.5,
      }
  const toFp = toFrame
    ? deviceFootprintPx(toFrame, toTargetId)
    : {
        widthPx: toSize.width * 0.7,
        heightPx: toSize.height * 0.5,
        cxPx: toSize.width * 0.5,
        cyPx: toSize.height * 0.5,
      }

  const lensCx = (lens.x / 100) * fromSize.width
  const lensCy = (lens.y / 100) * fromSize.height
  const lensW = (lens.width / 100) * fromSize.width
  const lensH = (lens.height / 100) * fromSize.height

  // Position relative to device center, normalized by device size
  const relX = (lensCx - fromFp.cxPx) / Math.max(1, fromFp.widthPx)
  const relY = (lensCy - fromFp.cyPx) / Math.max(1, fromFp.heightPx)
  // Window size as fraction of device (preserves magnified UI patch × zoom)
  const fracW = lensW / Math.max(1, fromFp.widthPx)
  const fracH = lensH / Math.max(1, fromFp.heightPx)

  const nextW = fracW * toFp.widthPx
  const nextH = fracH * toFp.heightPx
  const nextCx = toFp.cxPx + relX * toFp.widthPx
  const nextCy = toFp.cyPx + relY * toFp.heightPx

  return {
    ...lens,
    x: (nextCx / toSize.width) * 100,
    y: (nextCy / toSize.height) * 100,
    width: Math.max(6, Math.min(100, (nextW / toSize.width) * 100)),
    height: Math.max(6, Math.min(100, (nextH / toSize.height) * 100)),
    imageLocked: false,
    lockedImageId: null,
    lockedX: (nextCx / toSize.width) * 100,
    lockedY: (nextCy / toSize.height) * 100,
  }
}

export function adaptClipartToStoreTarget(
  clipart: ClipartLayer,
  fromTargetId: StoreTargetId,
  toTargetId: StoreTargetId,
): ClipartLayer {
  if (fromTargetId === toTargetId || clipart.attachedFrameId) return clipart
  const fromArt = artboardAspect(fromTargetId)
  const toArt = artboardAspect(toTargetId)
  const width = Math.min(
    CLIPART_WIDTH_MAX,
    Math.max(CLIPART_WIDTH_MIN, clipart.width * (fromArt / toArt)),
  )
  return { ...clipart, width }
}

function adaptSlide(
  slide: Slide,
  fromTargetId: StoreTargetId,
  toTargetId: StoreTargetId,
): Slide {
  const frames = slide.frames.map((frame) =>
    adaptFrameToStoreTarget(frame, fromTargetId, toTargetId),
  )

  return {
    ...slide,
    frames,
    texts: slide.texts.map((text) =>
      adaptTextToStoreTarget(text, fromTargetId, toTargetId),
    ),
    lenses: (slide.lenses ?? []).map((lens) => {
      const fromFrame = nearestFrame(lens, slide.frames)
      const toFrame = fromFrame
        ? (frames.find((frame) => frame.id === fromFrame.id) ?? frames[0] ?? null)
        : (frames[0] ?? null)
      return adaptLensToStoreTarget(
        lens,
        fromFrame,
        toFrame,
        fromTargetId,
        toTargetId,
      )
    }),
    cliparts: slide.cliparts.map((clipart) =>
      adaptClipartToStoreTarget(clipart, fromTargetId, toTargetId),
    ),
  }
}

/** Clone project slides for another store size (slides are in project.targetId space). */
export function adaptProjectToStoreTarget(
  project: Project,
  toTargetId: StoreTargetId,
): Project {
  const fromTargetId = project.targetId
  if (fromTargetId === toTargetId) {
    return { ...project, targetId: toTargetId }
  }

  return {
    ...project,
    targetId: toTargetId,
    slides: project.slides.map((slide) =>
      adaptSlide(slide, fromTargetId, toTargetId),
    ),
  }
}
