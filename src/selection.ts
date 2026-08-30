import { deviceSpec, findLayerInSlides } from "./constants"
import type {
  ClipartLayer,
  ClipartRecolor,
  Frame,
  LensLayer,
  Project,
  SelectedKind,
  Slide,
  TextAlign,
  TextLayer,
} from "./types"

/** Fields that can be batch-applied to a multi-selection (intersection depends on kinds). */
export type SelectionPatch = {
  x?: number
  y?: number
  rotation?: number
  flipH?: boolean
  flipV?: boolean
  shadow?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowOpacity?: number
  /** Frame */
  scale?: number
  rotationX?: number
  rotationY?: number
  deviceId?: Frame["deviceId"]
  /** Text */
  size?: number
  font?: string
  color?: string
  align?: TextAlign
  weight?: number
  strokeWidth?: number
  strokeColor?: string
  /** Shared size metric for text / clipart / lens */
  width?: number
  height?: number
  /** Clipart */
  opacity?: number
  blur?: number
  recolor?: ClipartRecolor
  color2?: string
  colorAngle?: number
  /** Lens */
  zoom?: number
  cornerRadius?: number
  borderWidth?: number
  borderColor?: string
}

/** @deprecated Use SelectionPatch */
export type SelectionCommonPatch = SelectionPatch

const UNIVERSAL_KEYS = [
  "x",
  "y",
  "rotation",
  "flipH",
  "flipV",
  "shadow",
  "shadowOffsetX",
  "shadowOffsetY",
  "shadowOpacity",
  "rotationX",
  "rotationY",
] as const

const FRAME_KEYS = [
  ...UNIVERSAL_KEYS,
  "scale",
  "deviceId",
] as const

const TEXT_KEYS = [
  ...UNIVERSAL_KEYS,
  "size",
  "width",
  "font",
  "color",
  "align",
  "weight",
  "strokeWidth",
  "strokeColor",
] as const

const CLIPART_KEYS = [
  ...UNIVERSAL_KEYS,
  "width",
  "opacity",
  "blur",
  "recolor",
  "color",
  "color2",
  "colorAngle",
] as const

const LENS_KEYS = [
  ...UNIVERSAL_KEYS,
  "width",
  "height",
  "zoom",
  "cornerRadius",
  "borderWidth",
  "borderColor",
] as const

/** Size-like fields only paste when source and target kinds match. */
const SAME_KIND_SIZE_KEYS = new Set<keyof SelectionPatch>([
  "scale",
  "width",
  "height",
  "size",
  "zoom",
  "deviceId",
])

export type PropertySectionId = "position" | "transform" | "style" | "shadow"

export const SECTION_KEYS: Record<
  PropertySectionId,
  readonly (keyof SelectionPatch)[]
> = {
  position: ["x", "y"],
  transform: [
    "rotation",
    "rotationX",
    "rotationY",
    "flipH",
    "flipV",
    "scale",
    "width",
    "height",
    "size",
    "zoom",
  ],
  style: [
    "strokeWidth",
    "strokeColor",
    "opacity",
    "blur",
    "recolor",
    "color",
    "color2",
    "colorAngle",
    "cornerRadius",
    "borderWidth",
    "borderColor",
    "font",
    "align",
    "weight",
  ],
  shadow: ["shadow", "shadowOffsetX", "shadowOffsetY", "shadowOpacity"],
}

export const SECTION_LABELS: Record<PropertySectionId, string> = {
  position: "Position",
  transform: "Transform",
  style: "Style",
  shadow: "Shadow",
}

type PatchableLayer = Frame | TextLayer | ClipartLayer | LensLayer

function pickKeys<T extends string>(
  patch: SelectionPatch,
  keys: readonly T[],
): Partial<SelectionPatch> {
  const next: Partial<SelectionPatch> = {}
  for (const key of keys) {
    if (patch[key as keyof SelectionPatch] !== undefined) {
      ;(next as Record<string, unknown>)[key] = patch[key as keyof SelectionPatch]
    }
  }
  return next
}

export function patchForKind(
  kind: SelectedKind,
  patch: SelectionPatch,
): Partial<SelectionPatch> {
  if (kind === "frame") return pickKeys(patch, FRAME_KEYS)
  if (kind === "text") return pickKeys(patch, TEXT_KEYS)
  if (kind === "clipart") return pickKeys(patch, CLIPART_KEYS)
  return pickKeys(patch, LENS_KEYS)
}

/** Snapshot section fields from a layer for the property clipboard. */
export function pickSectionPatch(
  layer: PatchableLayer,
  section: PropertySectionId,
): SelectionPatch {
  const patch: SelectionPatch = {}
  const record = layer as unknown as Record<string, unknown>
  for (const key of SECTION_KEYS[section]) {
    if (record[key] !== undefined) {
      ;(patch as Record<string, unknown>)[key] = record[key]
    }
  }
  return patch
}

/** Drop size-like fields when pasting across different layer kinds. */
export function filterPastePatch(
  patch: SelectionPatch,
  sourceKind: SelectedKind,
  targetKind: SelectedKind,
): SelectionPatch {
  const next = { ...patchForKind(targetKind, patch) } as SelectionPatch
  if (sourceKind !== targetKind) {
    for (const key of SAME_KIND_SIZE_KEYS) {
      delete next[key]
    }
  }
  return next
}

export type ResolvedSelectionLayer =
  | { kind: "frame"; id: string; ownerSlideId: string; layer: Frame }
  | { kind: "text"; id: string; ownerSlideId: string; layer: TextLayer }
  | { kind: "clipart"; id: string; ownerSlideId: string; layer: ClipartLayer }
  | { kind: "lens"; id: string; ownerSlideId: string; layer: LensLayer }

export function resolveSelectedLayers(
  project: Project,
  ids: string[],
): ResolvedSelectionLayer[] {
  const resolved: ResolvedSelectionLayer[] = []
  for (const id of ids) {
    const found = findLayerInSlides(project.slides, id)
    if (!found) continue
    if (found.kind === "frame") {
      resolved.push({
        kind: "frame",
        id,
        ownerSlideId: found.slide.id,
        layer: found.frame,
      })
      continue
    }
    if (found.kind === "text") {
      resolved.push({
        kind: "text",
        id,
        ownerSlideId: found.slide.id,
        layer: found.text,
      })
      continue
    }
    if (found.kind === "clipart") {
      resolved.push({
        kind: "clipart",
        id,
        ownerSlideId: found.slide.id,
        layer: found.clipart,
      })
      continue
    }
    resolved.push({
      kind: "lens",
      id,
      ownerSlideId: found.slide.id,
      layer: found.lens,
    })
  }
  return resolved
}

/** Same kind for every selected layer, or null when mixed / empty. */
export function uniformSelectionKind(
  layers: ResolvedSelectionLayer[],
): SelectedKind | null {
  if (!layers.length) return null
  const kind = layers[0]!.kind
  return layers.every((item) => item.kind === kind) ? kind : null
}

export type LayerMoveOrigin = {
  id: string
  kind: SelectedKind
  ownerSlideId: string
  x: number
  y: number
  attachedFrameId?: string | null
  attachedScale?: number
  attachedAspect?: number
}

export function getSelectedIds(slide: Slide): string[] {
  const raw =
    Array.isArray(slide.selectedIds) && slide.selectedIds.length > 0
      ? slide.selectedIds
      : slide.selectedId
        ? [slide.selectedId]
        : []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const id of raw) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function layerExistsOnSlide(slide: Slide, id: string): boolean {
  return (
    slide.frames.some((frame) => frame.id === id) ||
    slide.texts.some((text) => text.id === id) ||
    slide.cliparts.some((clipart) => clipart.id === id) ||
    (slide.lenses ?? []).some((lens) => lens.id === id) ||
    (slide.layerOrder ?? []).includes(id)
  )
}

export function withSlideSelection(
  slide: Slide,
  ids: string[],
  primaryId?: string,
): Slide {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    unique.push(id)
  }
  const selectedId =
    primaryId && unique.includes(primaryId)
      ? primaryId
      : (unique[unique.length - 1] ?? "")
  return {
    ...slide,
    selectedId,
    selectedIds: selectedId ? unique : [],
  }
}

export function toggleIdInSelection(
  slide: Slide,
  id: string,
): Slide {
  const current = getSelectedIds(slide)
  if (current.includes(id)) {
    return withSlideSelection(
      slide,
      current.filter((item) => item !== id),
    )
  }
  return withSlideSelection(slide, [...current, id], id)
}

export function selectionMoveOrigins(
  project: Project,
  ids: string[],
): LayerMoveOrigin[] {
  const origins: LayerMoveOrigin[] = []
  for (const id of ids) {
    const found = findLayerInSlides(project.slides, id)
    if (!found) continue
    if (found.kind === "frame") {
      origins.push({
        id,
        kind: "frame",
        ownerSlideId: found.slide.id,
        x: found.frame.x,
        y: found.frame.y,
      })
      continue
    }
    if (found.kind === "text") {
      origins.push({
        id,
        kind: "text",
        ownerSlideId: found.slide.id,
        x: found.text.x,
        y: found.text.y,
      })
      continue
    }
    if (found.kind === "lens") {
      origins.push({
        id,
        kind: "lens",
        ownerSlideId: found.slide.id,
        x: found.lens.x,
        y: found.lens.y,
      })
      continue
    }
    const clipart = found.clipart
    const attached = clipart.attachedFrameId
      ? found.slide.frames.find((frame) => frame.id === clipart.attachedFrameId)
      : null
    origins.push({
      id,
      kind: "clipart",
      ownerSlideId: found.slide.id,
      x: clipart.x,
      y: clipart.y,
      attachedFrameId: clipart.attachedFrameId,
      attachedScale: attached?.scale,
      attachedAspect: attached ? deviceSpec(attached.deviceId).aspect : undefined,
    })
  }
  return origins
}

function clampFree(x: number, y: number) {
  return {
    x: Math.min(130, Math.max(-30, x)),
    y: Math.min(130, Math.max(-30, y)),
  }
}

function clampLens(x: number, y: number) {
  return {
    x: Math.min(110, Math.max(-10, x)),
    y: Math.min(110, Math.max(-10, y)),
  }
}

function clampAttached(x: number, y: number) {
  return {
    x: Math.min(160, Math.max(-160, x)),
    y: Math.min(160, Math.max(-160, y)),
  }
}

/** Map an artboard % delta onto each origin (handles attached cliparts). */
export function positionsFromArtboardDelta(
  origins: LayerMoveOrigin[],
  dxArtboard: number,
  dyArtboard: number,
  artboardWidth: number,
  artboardHeight: number,
): Array<{
  kind: SelectedKind
  ownerSlideId: string
  id: string
  x: number
  y: number
}> {
  const aspect = artboardHeight / Math.max(1, artboardWidth)
  return origins.map((origin) => {
    if (
      origin.kind === "clipart" &&
      origin.attachedFrameId &&
      origin.attachedScale &&
      origin.attachedAspect
    ) {
      const dxDevice = dxArtboard / origin.attachedScale
      const dyDevice =
        (dyArtboard * aspect * origin.attachedAspect) / origin.attachedScale
      const next = clampAttached(origin.x + dxDevice, origin.y + dyDevice)
      return {
        kind: origin.kind,
        ownerSlideId: origin.ownerSlideId,
        id: origin.id,
        ...next,
      }
    }
    if (origin.kind === "lens") {
      return {
        kind: origin.kind,
        ownerSlideId: origin.ownerSlideId,
        id: origin.id,
        ...clampLens(origin.x + dxArtboard, origin.y + dyArtboard),
      }
    }
    return {
      kind: origin.kind,
      ownerSlideId: origin.ownerSlideId,
      id: origin.id,
      ...clampFree(origin.x + dxArtboard, origin.y + dyArtboard),
    }
  })
}

export function applyCommonPatchToLayer(
  _kind: SelectedKind,
  layer: Frame | TextLayer | ClipartLayer | LensLayer,
  patch: SelectionCommonPatch,
): Frame | TextLayer | ClipartLayer | LensLayer {
  return { ...layer, ...patch }
}

/** Snapshot of each selected layer's size metrics at gesture start. */
export type LayerSizeOrigin = {
  id: string
  kind: SelectedKind
  ownerSlideId: string
  scale?: number
  size?: number
  width?: number
  height?: number
}

export function selectionSizeOrigins(
  project: Project,
  ids: string[],
): LayerSizeOrigin[] {
  const origins: LayerSizeOrigin[] = []
  for (const id of ids) {
    const found = findLayerInSlides(project.slides, id)
    if (!found) continue
    if (found.kind === "frame") {
      origins.push({
        id,
        kind: "frame",
        ownerSlideId: found.slide.id,
        scale: found.frame.scale,
      })
      continue
    }
    if (found.kind === "text") {
      origins.push({
        id,
        kind: "text",
        ownerSlideId: found.slide.id,
        size: found.text.size,
        width: found.text.width,
      })
      continue
    }
    if (found.kind === "clipart") {
      origins.push({
        id,
        kind: "clipart",
        ownerSlideId: found.slide.id,
        width: found.clipart.width,
      })
      continue
    }
    origins.push({
      id,
      kind: "lens",
      ownerSlideId: found.slide.id,
      width: found.lens.width,
      height: found.lens.height,
    })
  }
  return origins
}

export function sizedPatchFromOrigin(
  origin: LayerSizeOrigin,
  factor: number,
): Partial<Frame & TextLayer & ClipartLayer & LensLayer> {
  const f = Math.min(4, Math.max(0.05, factor))
  if (origin.kind === "frame" && origin.scale != null) {
    return { scale: Math.min(1.1, Math.max(0.4, origin.scale * f)) }
  }
  if (origin.kind === "text") {
    return {
      size:
        origin.size != null
          ? Math.max(1, Math.round(origin.size * f))
          : undefined,
      width:
        origin.width != null
          ? Math.min(120, Math.max(10, origin.width * f))
          : undefined,
    }
  }
  if (origin.kind === "clipart" && origin.width != null) {
    return {
      width: Math.min(500, Math.max(1, origin.width * f)),
    }
  }
  return {
    width:
      origin.width != null
        ? Math.min(100, Math.max(6, origin.width * f))
        : undefined,
    height:
      origin.height != null
        ? Math.min(100, Math.max(6, origin.height * f))
        : undefined,
  }
}

/** Relative scale factor applied to each layer's own size metric (Inspector). */
export function scaleLayerByFactor(
  kind: SelectedKind,
  layer: Frame | TextLayer | ClipartLayer | LensLayer,
  factor: number,
): Partial<Frame & TextLayer & ClipartLayer & LensLayer> {
  if (kind === "frame") {
    return sizedPatchFromOrigin(
      {
        id: layer.id,
        kind,
        ownerSlideId: "",
        scale: (layer as Frame).scale,
      },
      factor,
    )
  }
  if (kind === "text") {
    const text = layer as TextLayer
    return sizedPatchFromOrigin(
      {
        id: text.id,
        kind,
        ownerSlideId: "",
        size: text.size,
        width: text.width,
      },
      factor,
    )
  }
  if (kind === "clipart") {
    return sizedPatchFromOrigin(
      {
        id: layer.id,
        kind,
        ownerSlideId: "",
        width: (layer as ClipartLayer).width,
      },
      factor,
    )
  }
  const lens = layer as LensLayer
  return sizedPatchFromOrigin(
    {
      id: lens.id,
      kind,
      ownerSlideId: "",
      width: lens.width,
      height: lens.height,
    },
    factor,
  )
}
