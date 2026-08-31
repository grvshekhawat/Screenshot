import type { DeviceId } from "./types"

export type DeviceChromeKind = "island" | "punch" | "tablet"

export type DeviceColorPreset = {
  id: string
  name: string
  color: string
}

/** Official-ish finishes for each chrome family (island = iPhone, punch = Pixel, tablet = iPad). */
export const DEVICE_COLOR_PRESETS: Record<DeviceChromeKind, DeviceColorPreset[]> =
  {
    island: [
      { id: "black-titanium", name: "Black Titanium", color: "#1c1c1e" },
      { id: "white-titanium", name: "White Titanium", color: "#f5f2eb" },
      { id: "natural-titanium", name: "Natural Titanium", color: "#bbb5a9" },
      { id: "desert-titanium", name: "Desert Titanium", color: "#c4a484" },
    ],
    punch: [
      { id: "obsidian", name: "Obsidian", color: "#1a1a1c" },
      { id: "porcelain", name: "Porcelain", color: "#f2efe8" },
      { id: "hazel", name: "Hazel", color: "#8b8578" },
      { id: "rose-quartz", name: "Rose Quartz", color: "#e8c4c0" },
      { id: "wintergreen", name: "Wintergreen", color: "#4a6b5c" },
    ],
    tablet: [
      { id: "space-gray", name: "Space Gray", color: "#3a3a3c" },
      { id: "silver", name: "Silver", color: "#e4e4e6" },
      { id: "starlight", name: "Starlight", color: "#f0e6d8" },
      { id: "blue", name: "Blue", color: "#5b7db3" },
      { id: "pink", name: "Pink", color: "#e8b4bc" },
    ],
  }

export function deviceChromeKind(deviceId: DeviceId): DeviceChromeKind {
  if (deviceId === "pixel" || deviceId === "pixel-land") return "punch"
  if (
    deviceId === "ipad-13" ||
    deviceId === "ipad-11" ||
    deviceId === "ipad-13-land" ||
    deviceId === "ipad-11-land"
  ) {
    return "tablet"
  }
  return "island"
}

export function deviceColorPresetsFor(deviceId: DeviceId): DeviceColorPreset[] {
  return DEVICE_COLOR_PRESETS[deviceChromeKind(deviceId)]
}

/** Chassis depth as a fraction of device width — tablets are far thinner than phones. */
const CHASSIS_DEPTH_RATIO: Record<DeviceChromeKind, number> = {
  island: 0.075,
  punch: 0.075,
  tablet: 0.028,
}

/** frame.thickness is a percentage of the model's own depth (100 = stock). */
export const DEFAULT_CHASSIS_THICKNESS = 100
export const MIN_CHASSIS_THICKNESS = 30
export const MAX_CHASSIS_THICKNESS = 250

export function normalizeChassisThickness(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_CHASSIS_THICKNESS
  }
  return Math.min(
    MAX_CHASSIS_THICKNESS,
    Math.max(MIN_CHASSIS_THICKNESS, Math.round(raw)),
  )
}

/** Fake chassis depth in px for the tilt illusion. */
export function chassisDepth(
  width: number,
  kind: DeviceChromeKind,
  thickness?: number,
): number {
  const pct = normalizeChassisThickness(thickness)
  return Math.max(2, width * CHASSIS_DEPTH_RATIO[kind] * (pct / 100))
}

export function normalizeFrameColor(
  raw: unknown,
  fallback = "#1c1c1e",
): string {
  if (typeof raw !== "string") return fallback
  const trimmed = raw.trim()
  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!match) return fallback
  let hex = match[1]
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("")
  }
  return `#${hex.toLowerCase()}`
}

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const n = normalizeFrameColor(hex)
  return [
    parseInt(n.slice(1, 3), 16),
    parseInt(n.slice(3, 5), 16),
    parseInt(n.slice(5, 7), 16),
  ]
}

function rgbToHex([r, g, b]: Rgb): string {
  const to = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0")
  return `#${to(r)}${to(g)}${to(b)}`
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

function luminance([r, g, b]: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Mix frame finish toward black (t=0 same, t=1 black). */
export function shadeFrameColor(hex: string, t: number): string {
  const base = hexToRgb(hex)
  return rgbToHex(mix(base, [0, 0, 0], Math.min(1, Math.max(0, t))))
}

/** Mix frame finish toward white. */
export function tintFrameColor(hex: string, t: number): string {
  const base = hexToRgb(hex)
  return rgbToHex(mix(base, [255, 255, 255], Math.min(1, Math.max(0, t))))
}

export type DeviceChromeStyles = {
  bodyBackground: string
  bodyBoxShadow: string
}

/** Metallic chassis gradients / shadows derived from a base finish color.
 * Bezel stays black in the frame markup — this only styles the outer shell. */
export function deviceChromeStyles(
  baseColor: string,
  width: number,
  kind: DeviceChromeKind,
): DeviceChromeStyles {
  const base = hexToRgb(baseColor)
  const lum = luminance(base)
  const light = lum > 0.55

  const edge = rgbToHex(
    light ? mix(base, [255, 255, 255], 0.35) : mix(base, [255, 255, 255], 0.42),
  )
  const nearEdge = rgbToHex(
    light ? mix(base, [0, 0, 0], 0.08) : mix(base, [0, 0, 0], 0.12),
  )
  const mid = rgbToHex(
    light ? mix(base, [0, 0, 0], 0.06) : mix(base, [0, 0, 0], 0.18),
  )
  const deep = rgbToHex(
    light ? mix(base, [0, 0, 0], 0.14) : mix(base, [0, 0, 0], 0.35),
  )
  const outline = rgbToHex(mix(base, [0, 0, 0], light ? 0.55 : 0.85))

  const highlight = light
    ? "rgba(255,255,255,0.55)"
    : "rgba(255,255,255,0.28)"
  const softHighlight = light
    ? "rgba(255,255,255,0.22)"
    : "rgba(255,255,255,0.08)"

  const hair = Math.max(1, width * 0.0025)
  // Thin metal lip only — deepest inset is always black (real bezel is a separate layer).
  const lip = Math.max(1, width * (kind === "island" ? 0.004 : 0.003))

  const bodyBackground =
    kind === "island"
      ? `linear-gradient(90deg, ${edge} 0%, ${nearEdge} 7%, ${deep} 18%, ${mid} 50%, ${deep} 82%, ${nearEdge} 93%, ${edge} 100%)`
      : kind === "punch"
        ? `linear-gradient(90deg, ${edge} 0%, ${nearEdge} 10%, ${mid} 50%, ${nearEdge} 90%, ${edge} 100%)`
        : `linear-gradient(90deg, ${edge} 0%, ${nearEdge} 12%, ${mid} 50%, ${nearEdge} 88%, ${edge} 100%)`

  const bodyBoxShadow =
    kind === "island"
      ? `
            0 0 0 ${hair}px ${outline},
            inset 0 0 0 ${Math.max(1, width * 0.003)}px ${highlight},
            inset 0 ${width * 0.01}px ${width * 0.018}px ${softHighlight},
            inset 0 0 0 ${lip}px rgba(0,0,0,0.35)
          `
      : `inset 0 0 0 ${Math.max(1, width * 0.003)}px ${highlight}, inset 0 0 0 ${lip}px rgba(0,0,0,0.4)`

  return {
    bodyBackground,
    bodyBoxShadow,
  }
}
