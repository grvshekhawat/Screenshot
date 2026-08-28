import type {
  ClipartLayer,
  DeviceId,
  Frame,
  LensLayer,
  Project,
  SelectedKind,
  Slide,
  SlideBackground,
  StoreTargetId,
  TemplateId,
  TextLayer,
} from "./types"

export const MAX_FRAMES = 6
export const MAX_TEXTS = 12
export const MAX_CLIPARTS = 12
export const MAX_LENSES = 4

export type DeviceSpec = {
  id: DeviceId
  name: string
  aspect: number
  bezel: number
  outerRadius: number
  screenRadius: number
  chrome: "island" | "punch" | "tablet"
  color: string
}

export const DEVICES: Record<DeviceId, DeviceSpec> = {
  "iphone-69": {
    id: "iphone-69",
    name: "iPhone 16/17 Pro Max",
    aspect: 0.476,
    bezel: 0.038,
    outerRadius: 0.168,
    screenRadius: 0.128,
    chrome: "island",
    color: "#1c1c1e",
  },
  pixel: {
    id: "pixel",
    name: "Pixel",
    aspect: 0.47,
    bezel: 0.022,
    outerRadius: 0.11,
    screenRadius: 0.09,
    chrome: "punch",
    color: "#2a2a2c",
  },
  "ipad-13": {
    id: "ipad-13",
    name: 'iPad 13"',
    aspect: 0.75,
    bezel: 0.028,
    outerRadius: 0.045,
    screenRadius: 0.028,
    chrome: "tablet",
    color: "#3a3a3c",
  },
  "ipad-11": {
    id: "ipad-11",
    name: 'iPad 11"',
    aspect: 0.657,
    bezel: 0.03,
    outerRadius: 0.05,
    screenRadius: 0.032,
    chrome: "tablet",
    color: "#3a3a3c",
  },
  "iphone-69-land": {
    id: "iphone-69-land",
    name: "iPhone 16/17 Pro Max",
    aspect: 1 / 0.476,
    bezel: 0.038,
    outerRadius: 0.168,
    screenRadius: 0.128,
    chrome: "island",
    color: "#1c1c1e",
  },
  "pixel-land": {
    id: "pixel-land",
    name: "Pixel",
    aspect: 1 / 0.47,
    bezel: 0.022,
    outerRadius: 0.11,
    screenRadius: 0.09,
    chrome: "punch",
    color: "#2a2a2c",
  },
  "ipad-13-land": {
    id: "ipad-13-land",
    name: 'iPad 13"',
    aspect: 1 / 0.75,
    bezel: 0.028,
    outerRadius: 0.045,
    screenRadius: 0.028,
    chrome: "tablet",
    color: "#3a3a3c",
  },
  "ipad-11-land": {
    id: "ipad-11-land",
    name: 'iPad 11"',
    aspect: 1 / 0.657,
    bezel: 0.03,
    outerRadius: 0.05,
    screenRadius: 0.032,
    chrome: "tablet",
    color: "#3a3a3c",
  },
}

export type StoreTarget = {
  id: StoreTargetId
  name: string
  width: number
  height: number
  folder: string
  /** Artboard orientation for gallery cards and chrome. */
  orientation: "portrait" | "landscape"
}

export const STORE_TARGETS: Record<StoreTargetId, StoreTarget> = {
  "iphone-69": {
    id: "iphone-69",
    name: 'App Store · iPhone 6.9"',
    width: 1320,
    height: 2868,
    folder: "ios/iphone-69",
    orientation: "portrait",
  },
  "iphone-65": {
    id: "iphone-65",
    name: 'App Store · iPhone 6.5" (legacy)',
    width: 1284,
    height: 2778,
    folder: "ios/iphone-65",
    orientation: "portrait",
  },
  "iphone-63": {
    id: "iphone-63",
    name: 'App Store · iPhone 6.3"',
    width: 1206,
    height: 2622,
    folder: "ios/iphone-63",
    orientation: "portrait",
  },
  "ipad-13": {
    id: "ipad-13",
    name: 'App Store · iPad 13"',
    width: 2064,
    height: 2752,
    folder: "ios/ipad-13",
    orientation: "portrait",
  },
  "ipad-11": {
    id: "ipad-11",
    name: 'App Store · iPad 11"',
    width: 1488,
    height: 2266,
    folder: "ios/ipad-11",
    orientation: "portrait",
  },
  "play-phone": {
    id: "play-phone",
    name: "Google Play · Phone",
    width: 1080,
    height: 1920,
    folder: "android/phone",
    orientation: "portrait",
  },
  "iphone-69-landscape": {
    id: "iphone-69-landscape",
    name: 'App Store · iPhone 6.9" landscape',
    width: 2868,
    height: 1320,
    folder: "ios/iphone-69-landscape",
    orientation: "landscape",
  },
  "iphone-65-landscape": {
    id: "iphone-65-landscape",
    name: 'App Store · iPhone 6.5" landscape',
    width: 2778,
    height: 1284,
    folder: "ios/iphone-65-landscape",
    orientation: "landscape",
  },
  "iphone-63-landscape": {
    id: "iphone-63-landscape",
    name: 'App Store · iPhone 6.3" landscape',
    width: 2622,
    height: 1206,
    folder: "ios/iphone-63-landscape",
    orientation: "landscape",
  },
  "ipad-13-landscape": {
    id: "ipad-13-landscape",
    name: 'App Store · iPad 13" landscape',
    width: 2752,
    height: 2064,
    folder: "ios/ipad-13-landscape",
    orientation: "landscape",
  },
  "ipad-11-landscape": {
    id: "ipad-11-landscape",
    name: 'App Store · iPad 11" landscape',
    width: 2266,
    height: 1488,
    folder: "ios/ipad-11-landscape",
    orientation: "landscape",
  },
  "play-phone-landscape": {
    id: "play-phone-landscape",
    name: "Google Play · Phone landscape",
    width: 1920,
    height: 1080,
    folder: "android/phone-landscape",
    orientation: "landscape",
  },
}

export const FONTS = [
  "Poppins",
  "Inter",
  "Space Grotesk",
  "Playfair Display",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Lato",
  "DM Sans",
  "Outfit",
] as const

export function defaultBackground(
  overrides: Partial<SlideBackground> = {},
): SlideBackground {
  return {
    type: "gradient",
    colors: ["#7c3aed", "#db2777"],
    angle: 165,
    imageId: null,
    imageFit: "cover",
    imageOpacity: 1,
    ...overrides,
  }
}

export const PALETTES: { name: string; colors: [string, string] }[] = [
  { name: "Sunset", colors: ["#ff6a00", "#ee0979"] },
  { name: "Ocean", colors: ["#2193b0", "#6dd5ed"] },
  { name: "Forest", colors: ["#11998e", "#38ef7d"] },
  { name: "Midnight", colors: ["#0f0c29", "#302b63"] },
  { name: "Candy", colors: ["#f953c6", "#b91d73"] },
  { name: "Citrus", colors: ["#f7971e", "#ffd200"] },
  { name: "Slate", colors: ["#2c3e50", "#4ca1af"] },
  { name: "Berry", colors: ["#8e2de2", "#4a00e0"] },
]

export type Template = {
  id: TemplateId
  name: string
  frame: Pick<
    Frame,
    "x" | "y" | "scale" | "rotation" | "rotationX" | "rotationY"
  >
  background: Pick<SlideBackground, "type" | "colors" | "angle">
  textStyle: Partial<Pick<TextLayer, "align" | "color" | "size" | "font">>
  textPlacement: "top" | "bottom"
  /** Hard two-tone split (angle in deg, ratio = first color share 0–100). */
  split?: { angle: number; ratio: number }
}

export function templateSplit(
  templateId: TemplateId,
): { angle: number; ratio: number } | null {
  return TEMPLATES.find((item) => item.id === templateId)?.split ?? null
}

export function splitBackgroundCss(
  split: { angle: number; ratio: number },
  colors: string[],
): string {
  const ratio = Math.min(95, Math.max(5, split.ratio))
  const c0 = colors[0] ?? "#111827"
  const c1 = colors[1] ?? colors[0] ?? "#f59e0b"
  return `linear-gradient(${split.angle}deg, ${c0} 0 ${ratio}%, ${c1} ${ratio}% 100%)`
}

export const TEMPLATES: Template[] = [
  {
    id: "device-top",
    name: "Device top",
    frame: { x: 50, y: 36, scale: 0.84, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#667eea", "#764ba2"], angle: 160 },
    textStyle: { align: "center", color: "#ffffff", size: 68 },
    textPlacement: "bottom",
  },
  {
    id: "device-bottom",
    name: "Device bottom",
    frame: { x: 50, y: 62, scale: 0.86, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#7c3aed", "#db2777"], angle: 165 },
    textStyle: { align: "center", color: "#ffffff", size: 72 },
    textPlacement: "top",
  },
  {
    id: "centered",
    name: "Centered",
    frame: { x: 50, y: 54, scale: 0.7, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#0ea5e9", "#6366f1"], angle: 180 },
    textStyle: { align: "center", color: "#ffffff", size: 64 },
    textPlacement: "top",
  },
  {
    id: "tilted",
    name: "Tilted",
    frame: { x: 54, y: 58, scale: 0.8, rotation: -14, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#f97316", "#ef4444"], angle: 145 },
    textStyle: { align: "left", color: "#ffffff", size: 70 },
    textPlacement: "top",
  },
  {
    id: "split",
    name: "Mid",
    frame: { x: 50, y: 58, scale: 0.78, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#111827", "#f59e0b"], angle: 180 },
    textStyle: { align: "center", color: "#ffffff", size: 68 },
    textPlacement: "top",
    split: { angle: 180, ratio: 48 },
  },
  {
    id: "split-third",
    name: "Top third",
    frame: { x: 50, y: 62, scale: 0.8, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#0f172a", "#22d3ee"], angle: 180 },
    textStyle: { align: "center", color: "#ffffff", size: 70 },
    textPlacement: "top",
    split: { angle: 180, ratio: 32 },
  },
  {
    id: "split-two-thirds",
    name: "Bottom third",
    frame: { x: 50, y: 48, scale: 0.76, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#4c1d95", "#f472b6"], angle: 180 },
    textStyle: { align: "center", color: "#ffffff", size: 68 },
    textPlacement: "bottom",
    split: { angle: 180, ratio: 68 },
  },
  {
    id: "split-low",
    name: "Low band",
    frame: { x: 50, y: 50, scale: 0.78, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#172554", "#f97316"], angle: 180 },
    textStyle: { align: "center", color: "#ffffff", size: 72 },
    textPlacement: "top",
    split: { angle: 180, ratio: 78 },
  },
  {
    id: "split-diagonal",
    name: "Diagonal",
    frame: { x: 50, y: 56, scale: 0.8, rotation: -6, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#111827", "#34d399"], angle: 135 },
    textStyle: { align: "left", color: "#ffffff", size: 68 },
    textPlacement: "top",
    split: { angle: 135, ratio: 50 },
  },
  {
    id: "split-diagonal-steep",
    name: "Steep",
    frame: { x: 52, y: 58, scale: 0.78, rotation: 8, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#1e1b4b", "#fb7185"], angle: 115 },
    textStyle: { align: "right", color: "#ffffff", size: 66 },
    textPlacement: "top",
    split: { angle: 115, ratio: 46 },
  },
  {
    id: "split-slash",
    name: "Slash",
    frame: { x: 48, y: 58, scale: 0.8, rotation: -10, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#0c0a09", "#fbbf24"], angle: 155 },
    textStyle: { align: "left", color: "#ffffff", size: 70 },
    textPlacement: "top",
    split: { angle: 155, ratio: 42 },
  },
  {
    id: "split-vertical",
    name: "Vertical",
    frame: { x: 58, y: 56, scale: 0.78, rotation: 0, rotationX: 0, rotationY: 10 },
    background: { type: "gradient", colors: ["#0f172a", "#38bdf8"], angle: 90 },
    textStyle: { align: "left", color: "#ffffff", size: 64 },
    textPlacement: "top",
    split: { angle: 90, ratio: 48 },
  },
  {
    id: "split-vertical-left",
    name: "Tall left",
    frame: { x: 62, y: 56, scale: 0.76, rotation: 0, rotationX: 0, rotationY: 8 },
    background: { type: "gradient", colors: ["#7c3aed", "#fde68a"], angle: 90 },
    textStyle: { align: "left", color: "#ffffff", size: 64 },
    textPlacement: "top",
    split: { angle: 90, ratio: 36 },
  },
  {
    id: "dark-glow",
    name: "Dark glow",
    frame: { x: 50, y: 56, scale: 0.8, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#020617", "#1e1b4b"], angle: 180 },
    textStyle: { align: "center", color: "#ffffff", size: 70 },
    textPlacement: "top",
  },
  {
    id: "close-up",
    name: "Close-up",
    frame: { x: 50, y: 58, scale: 1.05, rotation: 0, rotationX: 8, rotationY: 0 },
    background: { type: "gradient", colors: ["#0f172a", "#334155"], angle: 180 },
    textStyle: { align: "center", color: "#f8fafc", size: 56, font: "Space Grotesk" },
    textPlacement: "top",
  },
  {
    id: "floating",
    name: "Floating",
    frame: { x: 50, y: 42, scale: 0.62, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#ec4899", "#8b5cf6"], angle: 135 },
    textStyle: { align: "center", color: "#ffffff", size: 74 },
    textPlacement: "bottom",
  },
  {
    id: "offset-left",
    name: "Offset left",
    frame: { x: 36, y: 58, scale: 0.82, rotation: 8, rotationX: 0, rotationY: -12 },
    background: { type: "gradient", colors: ["#0369a1", "#0f766e"], angle: 160 },
    textStyle: { align: "right", color: "#ffffff", size: 66, font: "Montserrat" },
    textPlacement: "top",
  },
  {
    id: "offset-right",
    name: "Offset right",
    frame: { x: 64, y: 58, scale: 0.82, rotation: -8, rotationX: 0, rotationY: 12 },
    background: { type: "gradient", colors: ["#be123c", "#9f1239"], angle: 200 },
    textStyle: { align: "left", color: "#ffffff", size: 66, font: "Montserrat" },
    textPlacement: "top",
  },
  {
    id: "hero-peek",
    name: "Hero peek",
    frame: { x: 50, y: 78, scale: 0.92, rotation: 0, rotationX: -6, rotationY: 0 },
    background: { type: "gradient", colors: ["#1d4ed8", "#312e81"], angle: 175 },
    textStyle: { align: "center", color: "#ffffff", size: 76, font: "Poppins" },
    textPlacement: "top",
  },
  {
    id: "light-sky",
    name: "Light sky",
    frame: { x: 50, y: 60, scale: 0.8, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#e0f2fe", "#bae6fd"], angle: 180 },
    textStyle: { align: "center", color: "#0c4a6e", size: 70 },
    textPlacement: "top",
  },
  {
    id: "midnight-teal",
    name: "Midnight teal",
    frame: { x: 50, y: 55, scale: 0.78, rotation: -6, rotationX: 4, rotationY: 0 },
    background: { type: "gradient", colors: ["#042f2e", "#134e4a"], angle: 155 },
    textStyle: { align: "center", color: "#ccfbf1", size: 68, font: "Space Grotesk" },
    textPlacement: "top",
  },
  {
    id: "coral-punch",
    name: "Coral punch",
    frame: { x: 50, y: 64, scale: 0.84, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#fb7185", "#f97316"], angle: 140 },
    textStyle: { align: "center", color: "#ffffff", size: 72, font: "Montserrat" },
    textPlacement: "top",
  },
  {
    id: "soft-sand",
    name: "Soft sand",
    frame: { x: 50, y: 52, scale: 0.72, rotation: 0, rotationX: 0, rotationY: 0 },
    background: { type: "gradient", colors: ["#fef3c7", "#fdba74"], angle: 170 },
    textStyle: { align: "center", color: "#7c2d12", size: 68, font: "Playfair Display" },
    textPlacement: "bottom",
  },
  {
    id: "neon-lime",
    name: "Neon lime",
    frame: { x: 52, y: 58, scale: 0.8, rotation: 10, rotationX: 0, rotationY: -8 },
    background: { type: "gradient", colors: ["#14532d", "#365314"], angle: 180 },
    textStyle: { align: "left", color: "#d9f99d", size: 70, font: "Space Grotesk" },
    textPlacement: "top",
  },
]

export const TEXT_PLACEMENT: Record<TemplateId, "top" | "bottom"> = {
  "device-top": "bottom",
  "device-bottom": "top",
  centered: "top",
  tilted: "top",
  split: "top",
  "split-third": "top",
  "split-two-thirds": "bottom",
  "split-low": "top",
  "split-diagonal": "top",
  "split-diagonal-steep": "top",
  "split-slash": "top",
  "split-vertical": "top",
  "split-vertical-left": "top",
  "dark-glow": "top",
  "close-up": "top",
  floating: "bottom",
  "offset-left": "top",
  "offset-right": "top",
  "hero-peek": "top",
  "light-sky": "top",
  "midnight-teal": "top",
  "coral-punch": "top",
  "soft-sand": "bottom",
  "neon-lime": "top",
}

export function resolveDeviceId(deviceId: unknown): DeviceId {
  if (typeof deviceId === "string" && deviceId in DEVICES) {
    return deviceId as DeviceId
  }
  return "iphone-69"
}

export function deviceSpec(deviceId: unknown): DeviceSpec {
  return DEVICES[resolveDeviceId(deviceId)]
}

/**
 * Largest frame.scale where the device still fits inside the artboard
 * (width and height). UI Scale 100% maps to this value.
 */
export function maxFittingDeviceScale(
  deviceId: DeviceId,
  artboardWidth: number,
  artboardHeight: number,
): number {
  const aspect = deviceSpec(deviceId).aspect
  if (!(artboardWidth > 0) || !(artboardHeight > 0) || !(aspect > 0)) return 1
  const byWidth = 1
  const byHeight = (artboardHeight * aspect) / artboardWidth
  const max = Math.min(byWidth, byHeight)
  return Math.min(1.15, Math.max(0.2, max))
}

export function createFrame(
  overrides: Partial<Frame> & { screenSplitAxis?: string } = {},
): Frame {
  const { id, deviceId, screenSplitAxis, screenSplitAngle, ...rest } = overrides
  const angle =
    typeof screenSplitAngle === "number"
      ? screenSplitAngle
      : screenSplitAxis === "horizontal"
        ? 180
        : screenSplitAxis === "diagonal"
          ? 135
          : screenSplitAxis === "diagonal-slash"
            ? 45
            : 90
  const screenshotId = rest.screenshotId ?? null
  const screenshotIdB = rest.screenshotIdB ?? null
  const screenMode =
    rest.screenMode ?? (screenshotIdB ? "split" : "single")
  const shadow =
    typeof rest.shadow === "number" && Number.isFinite(rest.shadow)
      ? Math.min(80, Math.max(0, rest.shadow))
      : 24
  const shadowOffsetX =
    typeof rest.shadowOffsetX === "number" &&
    Number.isFinite(rest.shadowOffsetX)
      ? Math.min(40, Math.max(-40, rest.shadowOffsetX))
      : 0
  const shadowOffsetY =
    typeof rest.shadowOffsetY === "number" &&
    Number.isFinite(rest.shadowOffsetY)
      ? Math.min(40, Math.max(-40, rest.shadowOffsetY))
      : shadow > 0
        ? 8
        : 0
  const shadowOpacity =
    typeof rest.shadowOpacity === "number" &&
    Number.isFinite(rest.shadowOpacity)
      ? Math.min(100, Math.max(0, rest.shadowOpacity))
      : shadow > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0
        ? 55
        : 0
  return {
    x: 50,
    y: 62,
    scale: 0.86,
    rotation: 0,
    rotationX: 0,
    rotationY: 0,
    overflow: "cut",
    ...rest,
    deviceId: resolveDeviceId(deviceId),
    screenshotId,
    screenshotIdB,
    screenMode,
    screenSplitAngle: angle,
    screenSplitRatio:
      typeof rest.screenSplitRatio === "number" ? rest.screenSplitRatio : 50,
    shadow,
    shadowOffsetX,
    shadowOffsetY,
    shadowOpacity,
    id: id ?? crypto.randomUUID(),
  }
}

export function defaultLayerOrder(
  slide: Pick<Slide, "frames" | "cliparts" | "texts" | "lenses">,
): string[] {
  return [
    ...slide.frames.map((frame) => frame.id),
    ...slide.cliparts.map((clipart) => clipart.id),
    ...slide.texts.map((text) => text.id),
    ...(slide.lenses ?? []).map((lens) => lens.id),
  ]
}

export function normalizeLayerOrder(slide: Slide): string[] {
  const allIds = defaultLayerOrder(slide)
  const kept = (slide.layerOrder ?? []).filter((id) => allIds.includes(id))
  const missing = allIds.filter((id) => !kept.includes(id))
  return [...kept, ...missing]
}

export function layerZIndex(slide: Slide, id: string): number {
  const order = normalizeLayerOrder(slide)
  const index = order.indexOf(id)
  return index >= 0 ? index + 1 : order.length + 1
}

export function layerMoveLimits(slide: Slide, id: string) {
  const order = normalizeLayerOrder(slide)
  const index = order.indexOf(id)
  return {
    canMoveUp: index >= 0 && index < order.length - 1,
    canMoveDown: index > 0,
  }
}

export function moveInLayerOrder(
  order: string[],
  id: string,
  direction: "forward" | "back",
): string[] {
  const from = order.indexOf(id)
  if (from < 0) return order
  const to = direction === "forward" ? from + 1 : from - 1
  if (to < 0 || to >= order.length) return order
  const next = [...order]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function appendLayerOrder(
  order: string[],
  id: string,
  afterId?: string,
): string[] {
  if (order.includes(id)) return order
  if (afterId) {
    const index = order.indexOf(afterId)
    if (index >= 0) {
      const next = [...order]
      next.splice(index + 1, 0, id)
      return next
    }
  }
  return [...order, id]
}

export function removeFromLayerOrder(order: string[], id: string): string[] {
  return order.filter((item) => item !== id)
}

/** Ensure selectedId and layer order stay valid after edits. */
export function sanitizeSlideSelection(slide: Slide): Slide {
  const layerOrder = normalizeLayerOrder(slide)
  const selectedExists =
    slide.frames.some((frame) => frame.id === slide.selectedId) ||
    slide.texts.some((text) => text.id === slide.selectedId) ||
    slide.cliparts.some((clipart) => clipart.id === slide.selectedId) ||
    (slide.lenses ?? []).some((lens) => lens.id === slide.selectedId)
  return {
    ...slide,
    lenses: slide.lenses ?? [],
    layerOrder,
    selectedId: selectedExists
      ? slide.selectedId
      : (layerOrder[layerOrder.length - 1] ??
        slide.frames[0]?.id ??
        slide.texts[0]?.id ??
        slide.cliparts[0]?.id ??
        slide.lenses?.[0]?.id ??
        ""),
  }
}

export function createLens(overrides: Partial<LensLayer> & { shape?: string } = {}): LensLayer {
  const { shape: legacyShape, ...rest } = overrides
  const zoom =
    typeof rest.zoom === "number" && Number.isFinite(rest.zoom)
      ? Math.min(4, Math.max(1.25, rest.zoom))
      : 2
  const rotation =
    typeof rest.rotation === "number" && Number.isFinite(rest.rotation)
      ? Math.min(180, Math.max(-180, rest.rotation))
      : 0
  const width =
    typeof rest.width === "number" && Number.isFinite(rest.width)
      ? Math.min(100, Math.max(6, rest.width))
      : 42
  const height =
    typeof rest.height === "number" && Number.isFinite(rest.height)
      ? Math.min(100, Math.max(6, rest.height))
      : 28
  const defaultCorner = legacyShape === "circle" ? 50 : 28
  const cornerRadius =
    typeof rest.cornerRadius === "number" && Number.isFinite(rest.cornerRadius)
      ? Math.min(50, Math.max(0, rest.cornerRadius))
      : defaultCorner
  const borderWidth =
    typeof rest.borderWidth === "number" && Number.isFinite(rest.borderWidth)
      ? Math.min(160, Math.max(0, rest.borderWidth))
      : 10
  const shadow =
    typeof rest.shadow === "number" && Number.isFinite(rest.shadow)
      ? Math.min(80, Math.max(0, rest.shadow))
      : 18
  const x =
    typeof rest.x === "number" && Number.isFinite(rest.x)
      ? Math.min(100, Math.max(0, rest.x))
      : 50
  const y =
    typeof rest.y === "number" && Number.isFinite(rest.y)
      ? Math.min(100, Math.max(0, rest.y))
      : 42
  const lockedX =
    typeof rest.lockedX === "number" && Number.isFinite(rest.lockedX)
      ? rest.lockedX
      : x
  const lockedY =
    typeof rest.lockedY === "number" && Number.isFinite(rest.lockedY)
      ? rest.lockedY
      : y
  const lockedImageId = rest.lockedImageId ?? null
  const imageLocked = rest.imageLocked ?? Boolean(lockedImageId)
  return {
    ...rest,
    x,
    y,
    width,
    height,
    zoom,
    rotation,
    cornerRadius,
    borderWidth,
    shadow,
    borderColor: rest.borderColor ?? "#ffffff",
    imageLocked,
    lockedX,
    lockedY,
    lockedImageId,
    id: rest.id ?? crypto.randomUUID(),
  }
}

export function createClipart(overrides: Partial<ClipartLayer> = {}): ClipartLayer {
  const aspect =
    typeof overrides.aspect === "number" &&
    Number.isFinite(overrides.aspect) &&
    overrides.aspect > 0
      ? overrides.aspect
      : 1
  const opacity =
    typeof overrides.opacity === "number" && Number.isFinite(overrides.opacity)
      ? Math.min(1, Math.max(0, overrides.opacity))
      : 1
  const shadow =
    typeof overrides.shadow === "number" && Number.isFinite(overrides.shadow)
      ? Math.min(48, Math.max(0, overrides.shadow))
      : 0
  return {
    assetId: "",
    x: 50,
    y: 50,
    width: 28,
    rotation: 0,
    overflow: "cut",
    color: "#fbbf24",
    color2: "#f97316",
    colorAngle: 135,
    ...overrides,
    aspect,
    opacity,
    shadow,
    recolor: overrides.recolor ?? "off",
    attachedFrameId: overrides.attachedFrameId ?? null,
    id: overrides.id ?? crypto.randomUUID(),
  }
}

/** Decode an image URL and return width/height aspect (falls back to 1). */
export function probeImageAspect(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      resolve(w > 0 && h > 0 ? w / h : 1)
    }
    img.onerror = () => resolve(1)
    img.src = url
  })
}

export function createText(overrides: Partial<TextLayer> = {}): TextLayer {
  const weight =
    typeof overrides.weight === "number" && Number.isFinite(overrides.weight)
      ? Math.min(900, Math.max(100, Math.round(overrides.weight)))
      : 700
  const shadow =
    typeof overrides.shadow === "number" && Number.isFinite(overrides.shadow)
      ? Math.min(48, Math.max(0, overrides.shadow))
      : 0
  const shadowOffsetX =
    typeof overrides.shadowOffsetX === "number" &&
    Number.isFinite(overrides.shadowOffsetX)
      ? Math.min(40, Math.max(-40, overrides.shadowOffsetX))
      : 0
  const shadowOffsetY =
    typeof overrides.shadowOffsetY === "number" &&
    Number.isFinite(overrides.shadowOffsetY)
      ? Math.min(40, Math.max(-40, overrides.shadowOffsetY))
      : 0
  const shadowOpacity =
    typeof overrides.shadowOpacity === "number" &&
    Number.isFinite(overrides.shadowOpacity)
      ? Math.min(100, Math.max(0, overrides.shadowOpacity))
      : shadow > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0
        ? 55
        : 0
  const strokeWidth =
    typeof overrides.strokeWidth === "number" &&
    Number.isFinite(overrides.strokeWidth)
      ? Math.min(24, Math.max(0, overrides.strokeWidth))
      : 0
  return {
    content: "New text",
    x: 50,
    y: 12,
    width: 86,
    font: "Poppins",
    size: 64,
    color: "#ffffff",
    align: "center",
    rotation: 0,
    strokeColor: "#000000",
    ...overrides,
    weight,
    shadow,
    shadowOffsetX,
    shadowOffsetY,
    shadowOpacity,
    strokeWidth,
    id: overrides.id ?? crypto.randomUUID(),
  }
}

/** Soft / hard / clear shadow presets (shared by text + devices). */
export function textShadowPreset(
  kind: "soft" | "hard" | "none",
  size = 12,
): Pick<
  TextLayer,
  "shadow" | "shadowOffsetX" | "shadowOffsetY" | "shadowOpacity"
> {
  if (kind === "none") {
    return {
      shadow: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowOpacity: 0,
    }
  }
  if (kind === "hard") {
    const step = Math.max(2, Math.round(size * 0.35))
    return {
      shadow: 0,
      shadowOffsetX: step,
      shadowOffsetY: step,
      shadowOpacity: 85,
    }
  }
  return {
    shadow: Math.max(6, size),
    shadowOffsetX: 0,
    shadowOffsetY: Math.max(2, Math.round(size * 0.35)),
    shadowOpacity: 55,
  }
}

export const deviceShadowPreset = textShadowPreset

export function deviceShadowCss(
  frame: Pick<
    Frame,
    "shadow" | "shadowOffsetX" | "shadowOffsetY" | "shadowOpacity"
  >,
): string | undefined {
  const blur = frame.shadow ?? 0
  const ox = frame.shadowOffsetX ?? 0
  const oy = frame.shadowOffsetY ?? 0
  const opacityPct = frame.shadowOpacity ?? 0
  if (blur <= 0 && ox === 0 && oy === 0) return undefined
  const opacity = Math.min(1, Math.max(0, opacityPct / 100))
  if (opacity <= 0) return undefined
  return `drop-shadow(${ox}px ${oy}px ${Math.min(80, blur)}px rgba(0,0,0,${opacity}))`
}

export function textShadowCss(
  text: Pick<
    TextLayer,
    "shadow" | "shadowOffsetX" | "shadowOffsetY" | "shadowOpacity"
  >,
  fontScale: number,
): string | undefined {
  const blur = text.shadow ?? 0
  const ox = text.shadowOffsetX ?? 0
  const oy = text.shadowOffsetY ?? 0
  const opacityPct = text.shadowOpacity ?? 0
  if (blur <= 0 && ox === 0 && oy === 0) return undefined
  const opacity = Math.min(1, Math.max(0, opacityPct / 100))
  if (opacity <= 0) return undefined
  return `${ox * fontScale}px ${oy * fontScale}px ${blur * fontScale}px rgba(0,0,0,${opacity})`
}

export function defaultTexts(
  headline: string,
  subline: string,
  placement: "top" | "bottom" = "top",
  style: Partial<Pick<TextLayer, "font" | "size" | "color" | "align">> = {},
): TextLayer[] {
  const y0 = placement === "top" ? 10 : 88
  const y1 = placement === "top" ? 18 : 93
  const layers: TextLayer[] = []
  if (headline) {
    layers.push(
      createText({
        content: headline,
        y: y0,
        size: style.size ?? 72,
        font: style.font ?? "Poppins",
        color: style.color ?? "#ffffff",
        align: style.align ?? "center",
        weight: 700,
      }),
    )
  }
  if (subline) {
    layers.push(
      createText({
        content: subline,
        y: y1,
        size: Math.round((style.size ?? 72) * 0.38),
        font: style.font ?? "Poppins",
        color: style.color ?? "#ffffff",
        align: style.align ?? "center",
        weight: 500,
      }),
    )
  }
  return layers.length ? layers : [createText({ y: y0, ...style })]
}

export function getActiveFrame(slide: Slide): Frame | null {
  return (
    slide.frames.find((frame) => frame.id === slide.selectedId) ??
    slide.frames[0] ??
    null
  )
}

export function getActiveText(slide: Slide): TextLayer | null {
  return slide.texts.find((text) => text.id === slide.selectedId) ?? null
}

export function getActiveClipart(slide: Slide): ClipartLayer | null {
  return slide.cliparts.find((clipart) => clipart.id === slide.selectedId) ?? null
}

export function getActiveLens(slide: Slide): LensLayer | null {
  return (slide.lenses ?? []).find((lens) => lens.id === slide.selectedId) ?? null
}

export function selectedKind(slide: Slide): SelectedKind {
  if ((slide.lenses ?? []).some((lens) => lens.id === slide.selectedId)) {
    return "lens"
  }
  if (slide.cliparts.some((clipart) => clipart.id === slide.selectedId)) {
    return "clipart"
  }
  if (slide.texts.some((text) => text.id === slide.selectedId)) {
    return "text"
  }
  return "frame"
}

/** Whether the target slide has room for a copy of this component kind. */
export function canCopyComponentToSlide(
  kind: SelectedKind,
  target: Slide,
): boolean {
  if (kind === "frame") return target.frames.length < MAX_FRAMES
  if (kind === "clipart") return target.cliparts.length < MAX_CLIPARTS
  if (kind === "lens") return (target.lenses ?? []).length < MAX_LENSES
  return target.texts.length < MAX_TEXTS
}

export function applyTemplate(slide: Slide, templateId: TemplateId): Slide {
  const template = TEMPLATES.find((item) => item.id === templateId)
  if (!template) return slide
  const frames = slide.frames.length
    ? slide.frames.map((frame, index) =>
        index === 0 ? { ...frame, ...template.frame } : frame,
      )
    : [createFrame(template.frame)]
  const y0 = template.textPlacement === "top" ? 10 : 88
  const y1 = template.textPlacement === "top" ? 18 : 93
  const align = template.textStyle.align ?? "center"
  const color = template.textStyle.color ?? "#ffffff"
  const size = template.textStyle.size ?? 72
  const font = template.textStyle.font
  const textX = align === "left" ? 28 : align === "right" ? 72 : 50
  let texts = slide.texts
  if (!texts.length) {
    texts = defaultTexts(
      "Highlight a feature",
      "A short line that sells the benefit",
      template.textPlacement,
      template.textStyle,
    ).map((text) => ({ ...text, x: textX, align, color }))
  } else {
    texts = texts.map((text, index) => {
      if (index === 0) {
        return {
          ...text,
          x: textX,
          y: y0,
          align,
          color,
          size,
          font: font ?? text.font,
          rotation: 0,
        }
      }
      if (index === 1) {
        return {
          ...text,
          x: textX,
          y: y1,
          align,
          color,
          size: Math.round(size * 0.38),
          font: font ?? text.font,
          weight: 500,
          rotation: 0,
        }
      }
      return text
    })
  }
  return {
    ...slide,
    templateId,
    frames,
    texts,
    lenses: slide.lenses ?? [],
    layerOrder: normalizeLayerOrder({
      ...slide,
      frames,
      texts,
      lenses: slide.lenses ?? [],
    }),
    selectedId: slide.selectedId || frames[0].id,
    background: defaultBackground({
      type: template.background.type,
      colors: [...template.background.colors],
      angle: template.background.angle,
      imageId: null,
    }),
  }
}

type SlideDraft = Partial<Slide> & {
  headline?: string
  subline?: string
  textStyle?: Partial<Pick<TextLayer, "font" | "size" | "color" | "align">>
  activeFrameId?: string
}

export function createSlide(overrides: SlideDraft = {}): Slide {
  const first = createFrame()
  const texts =
    overrides.texts !== undefined
      ? overrides.texts.map((text) => createText(text))
      : defaultTexts(
          overrides.headline ?? "Highlight a feature",
          overrides.subline ?? "A short line that sells the benefit",
          TEXT_PLACEMENT[overrides.templateId ?? "device-bottom"],
          overrides.textStyle,
        )
  const frames =
    overrides.frames !== undefined
      ? overrides.frames.map((frame) => createFrame(frame))
      : [first]
  const cliparts =
    overrides.cliparts !== undefined
      ? overrides.cliparts.map((clipart) => createClipart(clipart))
      : []
  const lenses =
    overrides.lenses !== undefined
      ? overrides.lenses.map((lens) => createLens(lens))
      : []
  const selectedId =
    overrides.selectedId ??
    overrides.activeFrameId ??
    frames[0]?.id ??
    texts[0]?.id ??
    cliparts[0]?.id ??
    lenses[0]?.id ??
    ""
  return {
    id: overrides.id ?? crypto.randomUUID(),
    frames,
    texts,
    cliparts,
    lenses,
    layerOrder:
      overrides.layerOrder ??
      defaultLayerOrder({ frames, texts, cliparts, lenses }),
    selectedId,
    background: overrides.background
      ? defaultBackground(overrides.background)
      : defaultBackground(),
    templateId: overrides.templateId ?? "device-bottom",
  }
}

type LegacySlide = SlideDraft & {
  deviceId?: DeviceId
  device?: Pick<Frame, "x" | "y" | "scale" | "rotation">
  screenshotId?: string | null
}

export function normalizeSlide(raw: LegacySlide): Slide {
  const {
    deviceId,
    device,
    screenshotId,
    frames: rawFrames,
    texts: rawTexts,
    cliparts: rawCliparts,
    lenses: rawLenses,
    headline,
    subline,
    textStyle,
    activeFrameId,
    selectedId,
    background: rawBackground,
    ...rest
  } = raw
  const frames = Array.isArray(rawFrames)
    ? rawFrames.map((frame) => createFrame(frame))
    : [
        createFrame({
          deviceId,
          screenshotId: screenshotId ?? null,
          ...device,
        }),
      ]
  const texts = Array.isArray(rawTexts)
    ? rawTexts.map((text) => createText(text))
    : defaultTexts(
        headline ?? "",
        subline ?? "",
        TEXT_PLACEMENT[rest.templateId ?? "device-bottom"],
        textStyle,
      )
  const cliparts = Array.isArray(rawCliparts)
    ? rawCliparts.map((clipart) => createClipart(clipart))
    : []
  const lenses = Array.isArray(rawLenses)
    ? rawLenses.map((lens) => createLens(lens))
    : []
  const nextSelected =
    selectedId ??
    activeFrameId ??
    frames[0]?.id ??
    texts[0]?.id ??
    cliparts[0]?.id ??
    lenses[0]?.id
  return createSlide({
    ...rest,
    frames,
    texts,
    cliparts,
    lenses,
    layerOrder: raw.layerOrder,
    background: rawBackground ? defaultBackground(rawBackground) : undefined,
    selectedId: [...frames, ...texts, ...cliparts, ...lenses].some(
      (item) => item.id === nextSelected,
    )
      ? nextSelected
      : (frames[0]?.id ?? texts[0]?.id ?? cliparts[0]?.id ?? lenses[0]?.id ?? ""),
  })
}

export function normalizeProject(project: Project): Project {
  const slides = project.slides.map((slide) =>
    sanitizeSlideSelection(normalizeSlide(slide as LegacySlide)),
  )
  const targetId =
    project.targetId in STORE_TARGETS
      ? project.targetId
      : ("iphone-69" as const)
  const designTargetId =
    project.designTargetId && project.designTargetId in STORE_TARGETS
      ? project.designTargetId
      : targetId
  const activeSlideId = slides.some((slide) => slide.id === project.activeSlideId)
    ? project.activeSlideId
    : slides[0].id
  const sizeEditMode =
    project.sizeEditMode === "all" || project.sizeEditMode === "current"
      ? project.sizeEditMode
      : ("current" as const)
  const thumbnailLayout =
    project.thumbnailLayout === "portrait" ||
    project.thumbnailLayout === "landscape"
      ? project.thumbnailLayout
      : ("landscape" as const)

  const sizeLayouts: Project["sizeLayouts"] = { ...(project.sizeLayouts ?? {}) }
  for (const key of Object.keys(sizeLayouts) as StoreTargetId[]) {
    const layout = sizeLayouts[key]
    if (!layout?.slides?.length) {
      delete sizeLayouts[key]
      continue
    }
    const normalizedSlides = layout.slides.map((slide) =>
      sanitizeSlideSelection(normalizeSlide(slide as LegacySlide)),
    )
    sizeLayouts[key] = {
      slides: normalizedSlides,
      activeSlideId: normalizedSlides.some(
        (slide) => slide.id === layout.activeSlideId,
      )
        ? layout.activeSlideId
        : normalizedSlides[0].id,
    }
  }
  if (!sizeLayouts[targetId]) {
    sizeLayouts[targetId] = { slides, activeSlideId }
  }

  return {
    ...project,
    targetId,
    designTargetId,
    sizeEditMode,
    thumbnailLayout,
    sizeLayouts,
    slides,
    activeSlideId,
  }
}

export function createSampleProject(
  orientation: "portrait" | "landscape" = "portrait",
) {
  const targetId =
    orientation === "landscape"
      ? ("iphone-69-landscape" as const)
      : ("iphone-69" as const)
  const deviceId =
    orientation === "landscape"
      ? ("iphone-69-land" as const)
      : ("iphone-69" as const)

  const first = applyTemplate(
    createSlide({
      headline: "Welcome to Screenshot Studio",
      subline: "Upload a screen to frame it for the App Store",
      frames: [createFrame({ deviceId })],
    }),
    "device-bottom",
  )
  const second = applyTemplate(
    createSlide({
      headline: "Designed for conversion",
      subline: "Gradients, type, and device mockups",
      frames: [createFrame({ deviceId })],
    }),
    "tilted",
  )
  const third = applyTemplate(
    createSlide({
      headline: "Export. Upload. Ship.",
      subline: "Exact sizes for Apple and Google",
      frames: [createFrame({ deviceId })],
    }),
    "dark-glow",
  )
  const slides = [first, second, third]
  return {
    name:
      orientation === "landscape"
        ? "My Landscape Screenshots"
        : "My App Screenshots",
    targetId,
    designTargetId: targetId,
    sizeEditMode: "current" as const,
    thumbnailLayout: "landscape" as const,
    activeSlideId: first.id,
    slides,
    sizeLayouts: {
      [targetId]: {
        slides: structuredClone(slides),
        activeSlideId: first.id,
      },
    },
  }
}
