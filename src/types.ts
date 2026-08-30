export type DeviceId =
  | "iphone-69"
  | "pixel"
  | "ipad-13"
  | "ipad-11"
  | "iphone-69-land"
  | "pixel-land"
  | "ipad-13-land"
  | "ipad-11-land"

export type StoreTargetId =
  | "iphone-69"
  | "iphone-65"
  | "iphone-63"
  | "ipad-13"
  | "ipad-11"
  | "play-phone"
  | "iphone-69-landscape"
  | "iphone-65-landscape"
  | "iphone-63-landscape"
  | "ipad-13-landscape"
  | "ipad-11-landscape"
  | "play-phone-landscape"

export type TemplateId =
  | "device-top"
  | "device-bottom"
  | "centered"
  | "tilted"
  | "split"
  | "split-third"
  | "split-two-thirds"
  | "split-diagonal"
  | "split-diagonal-steep"
  | "split-vertical"
  | "split-vertical-left"
  | "split-slash"
  | "split-low"
  | "dark-glow"
  | "close-up"
  | "floating"
  | "offset-left"
  | "offset-right"
  | "hero-peek"
  | "light-sky"
  | "midnight-teal"
  | "coral-punch"
  | "soft-sand"
  | "neon-lime"

export type TextAlign = "left" | "center" | "right"

export type SlideBackground = {
  type: "solid" | "gradient" | "image"
  colors: string[]
  angle: number
  imageId: string | null
  imageFit: "cover" | "contain"
  imageOpacity: number
}

export type FrameScreenMode = "single" | "split"
export type FrameScreenSlot = "a" | "b"

export type Frame = {
  id: string
  deviceId: DeviceId
  screenshotId: string | null
  screenshotIdB: string | null
  screenMode: FrameScreenMode
  /** CSS linear-gradient angle for the hard split (0–360). */
  screenSplitAngle: number
  /** Percent of the screen for slot A (5–95). */
  screenSplitRatio: number
  x: number
  y: number
  scale: number
  rotation: number
  rotationX: number
  rotationY: number
  /** Mirror horizontally around the device center */
  flipH: boolean
  /** Mirror vertically around the device center */
  flipV: boolean
  /** Soft drop-shadow blur radius in artboard px (0 = hard edge when offset is set) */
  shadow: number
  shadowOffsetX: number
  shadowOffsetY: number
  /** Shadow opacity 0–100 */
  shadowOpacity: number
  overflow: "cut" | "continue"
}

export type TextLayer = {
  id: string
  content: string
  x: number
  y: number
  width: number
  font: string
  size: number
  color: string
  align: TextAlign
  weight: number
  rotation: number
  /** Perspective tilt around X (degrees) */
  rotationX: number
  /** Perspective tilt around Y (degrees) */
  rotationY: number
  /** Mirror horizontally around the text box center */
  flipH: boolean
  /** Mirror vertically around the text box center */
  flipV: boolean
  /** Shadow blur radius in design px (0 = hard edge when offset is set) */
  shadow: number
  shadowOffsetX: number
  shadowOffsetY: number
  /** Shadow opacity 0–100 */
  shadowOpacity: number
  overflow: "cut" | "continue"
  /** Outline width in design px (0 = none) */
  strokeWidth: number
  strokeColor: string
}

export type ClipartRecolor = "off" | "solid" | "gradient"

export type ClipartLayer = {
  id: string
  assetId: string
  x: number
  y: number
  /** Width as % of artboard width — or % of device width when attached. */
  width: number
  /** Natural width / height — locks proportions like phone aspect. */
  aspect: number
  rotation: number
  /** Perspective tilt around X (degrees) */
  rotationX: number
  /** Perspective tilt around Y (degrees) */
  rotationY: number
  /** Mirror horizontally around the clipart center */
  flipH: boolean
  /** Mirror vertically around the clipart center */
  flipV: boolean
  overflow: "cut" | "continue"
  /** 0–1 overall transparency */
  opacity: number
  /** Soft drop-shadow blur radius in artboard px (0 = hard edge when offset is set) */
  shadow: number
  shadowOffsetX: number
  shadowOffsetY: number
  /** Shadow opacity 0–100 */
  shadowOpacity: number
  /** Gaussian blur of the clipart itself in artboard px (0 = sharp) */
  blur: number
  /** Recolor the silhouette with a solid or gradient fill */
  recolor: ClipartRecolor
  color: string
  color2: string
  colorAngle: number
  /** When set, x/y/width are relative to this phone frame. */
  attachedFrameId: string | null
}

/** Magnifier that zooms a region of the slide (free-form rounded rect). */
export type LensLayer = {
  id: string
  /** Center X as % of artboard width */
  x: number
  /** Center Y as % of artboard height */
  y: number
  /** Width as % of artboard width */
  width: number
  /** Height as % of artboard height */
  height: number
  /** Magnification factor (e.g. 2 = 2×) */
  zoom: number
  /** Rotation in degrees */
  rotation: number
  /** Perspective tilt around X (degrees) */
  rotationX: number
  /** Perspective tilt around Y (degrees) */
  rotationY: number
  /** Mirror horizontally around the lens center */
  flipH: boolean
  /** Mirror vertically around the lens center */
  flipV: boolean
  /** Corner roundness, 0–50 (% of half the shorter side) */
  cornerRadius: number
  /** Border thickness in artboard px */
  borderWidth: number
  borderColor: string
  /** Soft drop-shadow blur radius in artboard px (0 = hard edge when offset is set) */
  shadow: number
  shadowOffsetX: number
  shadowOffsetY: number
  /** Shadow opacity 0–100 */
  shadowOpacity: number
  /** When true, magnified content stays at lockedX/Y while the lens moves. */
  imageLocked: boolean
  /** Slide anchor X (%) captured when image is locked. */
  lockedX: number
  /** Slide anchor Y (%) captured when image is locked. */
  lockedY: number
  /** Raster snapshot of the slide when locked (survives slide edits). */
  lockedImageId: string | null
  overflow: "cut" | "continue"
}

export type Slide = {
  id: string
  frames: Frame[]
  texts: TextLayer[]
  cliparts: ClipartLayer[]
  lenses: LensLayer[]
  /** Back-to-front draw order for all layers on the slide. */
  layerOrder: string[]
  /** Primary selected layer (last clicked). Empty when nothing selected. */
  selectedId: string
  /** All selected layer ids on this slide (includes selectedId). */
  selectedIds: string[]
  background: SlideBackground
  templateId: TemplateId
}

export type SizeEditMode = "current" | "all"

/** Catalog / project list thumbnail arrangement. */
export type ThumbnailLayout = "landscape" | "portrait"

export type SizeLayout = {
  slides: Slide[]
  activeSlideId: string
}

export type Project = {
  name: string
  /** Canvas size currently shown / edited. */
  targetId: StoreTargetId
  /**
   * current = each store size has its own saved layout.
   * all = selected component syncs across sizes (adapted).
   */
  sizeEditMode: SizeEditMode
  /** Source size for linked (“edit all”) adaptations. */
  designTargetId: StoreTargetId
  /**
   * How the multi-slide catalog thumbnail is composed.
   * landscape = slides in a horizontal strip; portrait = vertical stack.
   */
  thumbnailLayout: ThumbnailLayout
  activeSlideId: string
  slides: Slide[]
  /** Independent layouts per store size (always kept in sync with current). */
  sizeLayouts: Partial<Record<StoreTargetId, SizeLayout>>
}

export type SelectedKind = "frame" | "text" | "clipart" | "lens"
