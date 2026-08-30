/** CSS fragment appended after rotate / device matrix (empty when unflipped). */
export function layerFlipCss(flipH?: boolean, flipV?: boolean): string {
  const sx = flipH ? -1 : 1
  const sy = flipV ? -1 : 1
  if (sx === 1 && sy === 1) return ""
  return ` scale(${sx}, ${sy})`
}

/** Apply center-origin flip on a canvas already translated to the layer center. */
export function applyLayerFlip(
  ctx: CanvasRenderingContext2D,
  flipH?: boolean,
  flipV?: boolean,
): void {
  if (flipH || flipV) {
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
  }
}

export function normalizeFlipFlag(value: unknown): boolean {
  return value === true
}

/** Clamp perspective tilt like phone controls (−45°…45°). */
export function normalizeTilt(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(45, Math.max(-45, value))
}
