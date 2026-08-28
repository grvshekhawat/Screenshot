import type { CSSProperties, PointerEvent } from "react"

export type ResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"

const HANDLES: ResizeHandle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"]

const CURSOR: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
}

type ResizeHandlesProps = {
  /** Native artboard width (pre-zoom) */
  artboardWidth: number
  /** Canvas zoom scale — handle size tracks on-screen artboard size */
  canvasScale?: number
  onResizeStart: (handle: ResizeHandle, event: PointerEvent<HTMLDivElement>) => void
}

export function ResizeHandles({
  artboardWidth,
  canvasScale = 1,
  onResizeStart,
}: ResizeHandlesProps) {
  const s = Math.max(canvasScale, 0.04)
  // Target size in screen pixels: ~1.1% of how wide the artboard appears
  const screenW = artboardWidth * s
  const screenSize = Math.max(5, Math.min(11, screenW * 0.011))
  const screenEdge = Math.max(4, Math.min(9, screenW * 0.009))
  const screenBorder = Math.max(0.75, Math.min(1.5, screenW * 0.0012))
  // Convert to artboard coords (handles live inside transform: scale)
  const size = Math.round(screenSize / s)
  const edge = Math.round(screenEdge / s)
  const border = Math.max(1, Math.round(screenBorder / s))
  const radius = Math.max(1, Math.round(1.5 / s))

  return (
    <>
      {HANDLES.map((handle) => (
        <div
          key={handle}
          data-resize-handle={handle}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            try {
              event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
              /* ignore */
            }
            onResizeStart(handle, event)
          }}
          style={{
            ...handleStyle(handle, size, edge),
            cursor: CURSOR[handle],
            touchAction: "none",
            zIndex: 20,
            pointerEvents: "auto",
            background: "#ffffff",
            border: `${border}px solid #8b5cf6`,
            borderRadius: radius,
            boxSizing: "border-box",
          }}
        />
      ))}
    </>
  )
}

function handleStyle(
  handle: ResizeHandle,
  size: number,
  edge: number,
): CSSProperties {
  const half = size / 2
  const base: CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
  }

  switch (handle) {
    case "n":
      return {
        ...base,
        left: "50%",
        top: 0,
        width: edge * 2.5,
        transform: `translate(-50%, -${half}px)`,
      }
    case "s":
      return {
        ...base,
        left: "50%",
        bottom: 0,
        width: edge * 2.5,
        transform: `translate(-50%, ${half}px)`,
      }
    case "e":
      return {
        ...base,
        right: 0,
        top: "50%",
        height: edge * 2.5,
        transform: `translate(${half}px, -50%)`,
      }
    case "w":
      return {
        ...base,
        left: 0,
        top: "50%",
        height: edge * 2.5,
        transform: `translate(-${half}px, -50%)`,
      }
    case "ne":
      return {
        ...base,
        right: 0,
        top: 0,
        transform: `translate(${half}px, -${half}px)`,
      }
    case "nw":
      return {
        ...base,
        left: 0,
        top: 0,
        transform: `translate(-${half}px, -${half}px)`,
      }
    case "se":
      return {
        ...base,
        right: 0,
        bottom: 0,
        transform: `translate(${half}px, ${half}px)`,
      }
    case "sw":
      return {
        ...base,
        left: 0,
        bottom: 0,
        transform: `translate(-${half}px, ${half}px)`,
      }
  }
}

/** Signed scale factor from drag relative to element center (screen space). */
export function resizeFactorFromCenter(
  handle: ResizeHandle,
  startClientX: number,
  startClientY: number,
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
): number {
  const startDx = startClientX - centerX
  const startDy = startClientY - centerY
  const dx = clientX - centerX
  const dy = clientY - centerY

  const axis = handleAxis(handle)
  if (axis === "x") {
    const start = Math.abs(startDx) || 1
    return Math.abs(dx) / start
  }
  if (axis === "y") {
    const start = Math.abs(startDy) || 1
    return Math.abs(dy) / start
  }
  const startDist = Math.hypot(startDx, startDy) || 1
  return Math.hypot(dx, dy) / startDist
}

function handleAxis(handle: ResizeHandle): "x" | "y" | "both" {
  if (handle === "e" || handle === "w") return "x"
  if (handle === "n" || handle === "s") return "y"
  return "both"
}
