import {
  VIDEO_DURATION_DEFAULT,
  VIDEO_FPS,
  clampVideoDurationSec,
} from "./constants"
import type {
  ClipartLayer,
  Frame,
  LayerAnimType,
  LensLayer,
  Slide,
  SlideBackground,
  TextLayer,
} from "./types"

export type VideoSegment = {
  fromIndex: number
  toIndex: number
  durationSec: number
}

export function frameLinkLabel(frames: Frame[], frameId: string): string {
  const index = frames.findIndex((frame) => frame.id === frameId)
  return index >= 0 ? `Phone ${index + 1}` : "Phone"
}

export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Shortest-path interpolation for degrees (e.g. 350 → 10). */
export function lerpAngle(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180
  return a + delta * t
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  if (!pa || !pb) return t < 0.5 ? a : b
  const r = Math.round(lerp(pa[0], pb[0], t))
  const g = Math.round(lerp(pa[1], pb[1], t))
  const bl = Math.round(lerp(pa[2], pb[2], t))
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`
}

function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace("#", "")
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ]
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ]
  }
  return null
}

function pairFrames(
  from: Frame[],
  to: Frame[],
): Array<{ from: Frame; to: Frame }> {
  const toById = new Map(to.map((item) => [item.id, item]))
  const usedTo = new Set<string>()
  const linked: Array<{ from: Frame; to: Frame }> = []
  for (const item of from) {
    const targetId = item.tweenToId
    if (!targetId || usedTo.has(targetId)) continue
    const target = toById.get(targetId)
    if (!target) continue
    usedTo.add(targetId)
    linked.push({ from: item, to: target })
  }
  return linked
}

/** Percent artboard coords: push past nearest edge. */
function nearestEdgeOffscreen(x: number, y: number): { x: number; y: number } {
  const left = x
  const right = 100 - x
  const top = y
  const bottom = 100 - y
  const nearest = Math.min(left, right, top, bottom)
  if (nearest === left) return { x: -80, y }
  if (nearest === right) return { x: 180, y }
  if (nearest === top) return { x, y: -80 }
  return { x, y: 180 }
}

function slideOffsetForDir(
  anim: LayerAnimType,
  x: number,
  y: number,
): { x: number; y: number } | null {
  switch (anim) {
    case "slideLeft":
      return { x: -80, y }
    case "slideRight":
      return { x: 180, y }
    case "slideUp":
      return { x, y: -80 }
    case "slideDown":
      return { x, y: 180 }
    default:
      return null
  }
}

type PoseFields = {
  x: number
  y: number
  scale?: number
  size?: number
  width?: number
  height?: number
  opacity: number
}

function applyExitAnim<T extends PoseFields>(
  layer: T,
  anim: LayerAnimType,
  t: number,
): T {
  const e = Math.min(1, Math.max(0, t))
  if (anim === "none") return { ...layer }

  let { x, y, opacity } = layer
  let scale = layer.scale
  let size = layer.size
  let width = layer.width
  let height = layer.height

  if (anim === "fade") {
    opacity = lerp(opacity, 0, e)
  } else if (anim === "zoomOut") {
    if (scale != null) scale = lerp(scale, scale * 0.2, e)
    if (size != null) size = lerp(size, size * 0.2, e)
    if (width != null) width = lerp(width, width * 0.2, e)
    if (height != null) height = lerp(height, height * 0.2, e)
    opacity = lerp(opacity, 0, e)
  } else if (anim === "zoomIn") {
    if (scale != null) scale = lerp(scale, scale * 2.2, e)
    if (size != null) size = lerp(size, size * 2.2, e)
    if (width != null) width = lerp(width, width * 2.2, e)
    if (height != null) height = lerp(height, height * 2.2, e)
    opacity = lerp(opacity, 0, e)
  } else {
    const off =
      slideOffsetForDir(anim, x, y) ?? nearestEdgeOffscreen(x, y)
    x = lerp(x, off.x, e)
    y = lerp(y, off.y, e)
  }

  return {
    ...layer,
    x,
    y,
    opacity,
    ...(scale != null ? { scale } : {}),
    ...(size != null ? { size } : {}),
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
  }
}

function applyEnterAnim<T extends PoseFields>(
  layer: T,
  anim: LayerAnimType,
  t: number,
): T {
  const e = Math.min(1, Math.max(0, t))
  if (anim === "none") return { ...layer }

  const end = { ...layer }
  let x = end.x
  let y = end.y
  let opacity = end.opacity
  let scale = end.scale
  let size = end.size
  let width = end.width
  let height = end.height

  if (anim === "fade") {
    opacity = lerp(0, end.opacity, e)
  } else if (anim === "zoomIn") {
    if (scale != null) scale = lerp(scale * 0.2, end.scale!, e)
    if (size != null) size = lerp(size * 0.2, end.size!, e)
    if (width != null) width = lerp(width * 0.2, end.width!, e)
    if (height != null) height = lerp(height * 0.2, end.height!, e)
    opacity = lerp(0, end.opacity, e)
  } else if (anim === "zoomOut") {
    if (scale != null) scale = lerp(scale * 2.2, end.scale!, e)
    if (size != null) size = lerp(size * 2.2, end.size!, e)
    if (width != null) width = lerp(width * 2.2, end.width!, e)
    if (height != null) height = lerp(height * 2.2, end.height!, e)
    opacity = lerp(0, end.opacity, e)
  } else {
    const off =
      slideOffsetForDir(anim, end.x, end.y) ??
      nearestEdgeOffscreen(end.x, end.y)
    x = lerp(off.x, end.x, e)
    y = lerp(off.y, end.y, e)
  }

  return {
    ...end,
    x,
    y,
    opacity,
    ...(scale != null ? { scale } : {}),
    ...(size != null ? { size } : {}),
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
  }
}

function tweenFrame(from: Frame, to: Frame, t: number): Frame {
  return {
    ...from,
    id: t < 0.5 ? from.id : to.id,
    deviceId: t < 0.5 ? from.deviceId : to.deviceId,
    color: lerpColor(from.color, to.color, t),
    thickness: lerp(from.thickness, to.thickness, t),
    screenshotId: t < 0.5 ? from.screenshotId : to.screenshotId,
    screenshotIdB: t < 0.5 ? from.screenshotIdB : to.screenshotIdB,
    screenMode: t < 0.5 ? from.screenMode : to.screenMode,
    screenSplitAngle: lerpAngle(from.screenSplitAngle, to.screenSplitAngle, t),
    screenSplitRatio: lerp(from.screenSplitRatio, to.screenSplitRatio, t),
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    scale: lerp(from.scale, to.scale, t),
    rotation: lerpAngle(from.rotation, to.rotation, t),
    rotationX: lerp(from.rotationX, to.rotationX, t),
    rotationY: lerp(from.rotationY, to.rotationY, t),
    flipH: t < 0.5 ? from.flipH : to.flipH,
    flipV: t < 0.5 ? from.flipV : to.flipV,
    shadow: lerp(from.shadow, to.shadow, t),
    shadowOffsetX: lerp(from.shadowOffsetX, to.shadowOffsetX, t),
    shadowOffsetY: lerp(from.shadowOffsetY, to.shadowOffsetY, t),
    shadowOpacity: lerp(from.shadowOpacity, to.shadowOpacity, t),
    shadowColor: lerpColor(from.shadowColor, to.shadowColor, t),
    showBand: t < 0.5 ? from.showBand : to.showBand,
    overflow: t < 0.5 ? from.overflow : to.overflow,
    tweenToId: t < 0.5 ? from.tweenToId : to.tweenToId,
    opacity: lerp(from.opacity, to.opacity, t),
    enterAnim: t < 0.5 ? from.enterAnim : to.enterAnim,
    exitAnim: t < 0.5 ? from.exitAnim : to.exitAnim,
  }
}

function tweenBackground(
  from: SlideBackground,
  to: SlideBackground,
  t: number,
): SlideBackground {
  const n = Math.max(from.colors.length, to.colors.length)
  const colors = Array.from({ length: n }, (_, i) =>
    lerpColor(
      from.colors[i] ?? from.colors[0] ?? "#000000",
      to.colors[i] ?? to.colors[0] ?? "#000000",
      t,
    ),
  )
  return {
    ...from,
    type: t < 0.5 ? from.type : to.type,
    colors,
    angle: lerpAngle(from.angle, to.angle, t),
    imageId: t < 0.5 ? from.imageId : to.imageId,
    imageFit: t < 0.5 ? from.imageFit : to.imageFit,
    imageOpacity: lerp(from.imageOpacity, to.imageOpacity, t),
    imagePositionX: lerp(from.imagePositionX, to.imagePositionX, t),
    imagePositionY: lerp(from.imagePositionY, to.imagePositionY, t),
  }
}

/** Fraction of each slide's duration spent holding the rest pose before transitioning. */
const SLIDE_HOLD_FRACTION = 0.55

/**
 * Interpolate layers from `from` toward `to`.
 * Linked phones (`tweenToId`) pose-tween across the transition window.
 * Unlinked phones + text/clipart/lens: exit A then enter B inside that window.
 * The first portion of `durationSec` holds the leaving slide at rest so content
 * stays on screen for most of the slide time.
 */
export function interpolateSlides(from: Slide, to: Slide, rawT: number): Slide {
  const clock = Math.min(1, Math.max(0, rawT))
  if (clock < SLIDE_HOLD_FRACTION) {
    return {
      ...from,
      selectedId: "",
      selectedIds: [],
    }
  }

  const transitionClock =
    (clock - SLIDE_HOLD_FRACTION) / (1 - SLIDE_HOLD_FRACTION)
  const t = easeInOutCubic(transitionClock)
  // Exit first half of the transition, enter second half.
  const exitT = transitionClock < 0.5 ? transitionClock * 2 : 1
  const enterT = transitionClock < 0.5 ? 0 : (transitionClock - 0.5) * 2
  const exitEased = easeInOutCubic(exitT)
  const enterEased = easeInOutCubic(enterT)

  const linked = pairFrames(from.frames, to.frames)
  const usedFrom = new Set(linked.map((pair) => pair.from.id))
  const usedTo = new Set(linked.map((pair) => pair.to.id))
  const tweened = linked.map(({ from: a, to: b }) => tweenFrame(a, b, t))

  const exiting =
    exitT < 1
      ? from.frames
          .filter((frame) => !usedFrom.has(frame.id))
          .map((frame) => applyExitAnim(frame, frame.exitAnim, exitEased))
      : []
  const arriving =
    transitionClock >= 0.5
      ? to.frames
          .filter((frame) => !usedTo.has(frame.id))
          .map((frame) => applyEnterAnim(frame, frame.enterAnim, enterEased))
      : []

  const frames = [...arriving, ...tweened, ...exiting]

  const texts: TextLayer[] = [
    ...(exitT < 1
      ? from.texts.map((layer) =>
          applyExitAnim(layer, layer.exitAnim, exitEased),
        )
      : []),
    ...(transitionClock >= 0.5
      ? to.texts.map((layer) =>
          applyEnterAnim(layer, layer.enterAnim, enterEased),
        )
      : []),
  ]
  const cliparts: ClipartLayer[] = [
    ...(exitT < 1
      ? from.cliparts.map((layer) =>
          applyExitAnim(layer, layer.exitAnim, exitEased),
        )
      : []),
    ...(transitionClock >= 0.5
      ? to.cliparts.map((layer) =>
          applyEnterAnim(layer, layer.enterAnim, enterEased),
        )
      : []),
  ]
  const lenses: LensLayer[] = [
    ...(exitT < 1
      ? (from.lenses ?? []).map((layer) =>
          applyExitAnim(layer, layer.exitAnim, exitEased),
        )
      : []),
    ...(transitionClock >= 0.5
      ? (to.lenses ?? []).map((layer) =>
          applyEnterAnim(layer, layer.enterAnim, enterEased),
        )
      : []),
  ]

  const layerOrder = [
    ...frames.map((item) => item.id),
    ...texts.map((item) => item.id),
    ...cliparts.map((item) => item.id),
    ...lenses.map((item) => item.id),
  ]
  return {
    ...from,
    frames,
    texts,
    cliparts,
    lenses,
    layerOrder,
    background: tweenBackground(from.background, to.background, t),
    selectedId: "",
    selectedIds: [],
  }
}

export function slideDurationSec(slide: Slide): number {
  return clampVideoDurationSec(slide.durationSec ?? VIDEO_DURATION_DEFAULT)
}

export function videoSegments(slides: Slide[]): VideoSegment[] {
  if (slides.length === 0) return []
  if (slides.length === 1) {
    return [
      { fromIndex: 0, toIndex: 0, durationSec: slideDurationSec(slides[0]) },
    ]
  }
  const transitions = slides.slice(0, -1).map((slide, index) => ({
    fromIndex: index,
    toIndex: index + 1,
    durationSec: slideDurationSec(slide),
  }))
  const last = slides.length - 1
  return [
    ...transitions,
    {
      fromIndex: last,
      toIndex: last,
      durationSec: slideDurationSec(slides[last]),
    },
  ]
}

export function totalVideoDurationSec(slides: Slide[]): number {
  return videoSegments(slides).reduce((sum, item) => sum + item.durationSec, 0)
}

export function slideAtVideoTime(slides: Slide[], timeSec: number): Slide {
  const segments = videoSegments(slides)
  if (!segments.length) return slides[0]
  let remaining = Math.max(0, timeSec)
  for (const segment of segments) {
    if (remaining < segment.durationSec) {
      const from = slides[segment.fromIndex]
      const to = slides[segment.toIndex]
      if (segment.fromIndex === segment.toIndex) return from
      return interpolateSlides(from, to, remaining / segment.durationSec)
    }
    remaining -= segment.durationSec
  }
  return slides[slides.length - 1]
}

export function videoFrameTimes(slides: Slide[]): number[] {
  const total = totalVideoDurationSec(slides)
  const frames = Math.max(1, Math.round(total * VIDEO_FPS))
  const times: number[] = []
  const step = 1 / VIDEO_FPS
  for (let i = 0; i < frames; i++) times.push(i * step)
  return times
}
