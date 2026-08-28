const cache = new Map<string, string>()

let probeEl: HTMLDivElement | null = null

function ensureProbe(): HTMLDivElement | null {
  if (typeof document === "undefined") return null
  if (probeEl) return probeEl

  const root = document.createElement("div")
  root.style.cssText =
    "position:fixed;left:-9999px;top:0;visibility:hidden;width:100px;height:100px;"
  probeEl = document.createElement("div")
  probeEl.style.cssText = "width:100px;height:100px;transform-origin:center center;"
  root.appendChild(probeEl)
  document.body.appendChild(root)
  return probeEl
}

export function devicePerspective(artboardWidth: number): number {
  return Math.max(1200, artboardWidth * 1.4)
}

/** Flatten perspective + 3-axis rotation to one matrix so split slides clip identically. */
export function flattenedDeviceTransform(
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  artboardWidth: number,
): string {
  const perspective = devicePerspective(artboardWidth)
  const key = `${rotationX}|${rotationY}|${rotationZ}|${perspective}`
  const cached = cache.get(key)
  if (cached) return cached

  const chain = `perspective(${perspective}px) rotateX(${rotationX}deg) rotateY(${rotationY}deg) rotateZ(${rotationZ}deg)`
  const el = ensureProbe()
  if (!el) {
    cache.set(key, chain)
    return chain
  }

  el.style.transform = chain
  const computed = getComputedStyle(el).transform
  const result = computed === "none" ? chain : computed
  cache.set(key, result)
  return result
}
