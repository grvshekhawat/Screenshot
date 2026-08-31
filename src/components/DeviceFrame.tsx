import { useState, type ReactNode } from "react"
import { deviceShadowCss } from "../constants"
import {
  chassisDepth,
  deviceChromeStyles,
  normalizeFrameColor,
  shadeFrameColor,
  tintFrameColor,
} from "../device-chrome"
import type { DeviceId } from "../types"

type DeviceFrameProps = {
  deviceId: DeviceId
  width: number
  /** Chassis / bezel finish (hex). */
  color?: string
  screenshotUrl: string | null
  screenshotUrlB?: string | null
  screenMode?: "single" | "split"
  screenSplitAngle?: number
  screenSplitRatio?: number
  interactive?: boolean
  /** Soft drop-shadow blur in CSS px, with optional offset / opacity. */
  shadow?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowOpacity?: number
  shadowColor?: string
  /** Perspective tilt — drives fake chassis thickness when tilted. */
  rotationX?: number
  rotationY?: number
  /** Chassis depth as a % of the model's own thickness (100 = stock). */
  thickness?: number
  onUploadClick?: (slot?: "a" | "b") => void
}

export function DeviceFrame({
  deviceId,
  width,
  color,
  screenshotUrl,
  screenshotUrlB = null,
  screenMode = "single",
  screenSplitAngle = 90,
  screenSplitRatio = 50,
  interactive = false,
  shadow = 24,
  shadowOffsetX = 0,
  shadowOffsetY = 8,
  shadowOpacity = 55,
  shadowColor = "#000000",
  rotationX = 0,
  rotationY = 0,
  thickness,
  onUploadClick,
}: DeviceFrameProps) {
  const isLandscapePhone =
    deviceId === "iphone-69-land" ||
    deviceId === "pixel-land" ||
    deviceId === "ipad-13-land" ||
    deviceId === "ipad-11-land"

  const chromeId =
    deviceId === "iphone-69-land"
      ? "iphone-69"
      : deviceId === "pixel-land"
        ? "pixel"
        : deviceId === "ipad-13-land"
          ? "ipad-13"
          : deviceId === "ipad-11-land"
            ? "ipad-11"
            : deviceId

  const finish = normalizeFrameColor(color, "#1c1c1e")

  const portraitAspect =
    chromeId === "iphone-69"
      ? 0.476
      : chromeId === "pixel"
        ? 0.47
        : chromeId === "ipad-13"
          ? 0.75
          : 0.657

  const screen = (
    <ScreenContent
      screenshotUrl={screenshotUrl}
      screenshotUrlB={screenshotUrlB}
      screenMode={screenMode}
      screenSplitAngle={screenSplitAngle}
      screenSplitRatio={screenSplitRatio}
      imageFit={
        chromeId === "ipad-13" || chromeId === "ipad-11" ? "contain" : "cover"
      }
      interactive={interactive}
      onUploadClick={onUploadClick}
    />
  )

  const dropShadow = deviceShadowCss({
    shadow,
    shadowOffsetX,
    shadowOffsetY,
    shadowOpacity,
    shadowColor,
  })

  const frameWidth = isLandscapePhone ? width * portraitAspect : width
  const tilt = { rotationX, rotationY, thickness }

  const frame =
    chromeId === "iphone-69" ? (
      <IPhoneFrame
        width={frameWidth}
        color={finish}
        dropShadow={dropShadow}
        {...tilt}
      >
        {isLandscapePhone ? (
          <UprightLandscapeScreen>{screen}</UprightLandscapeScreen>
        ) : (
          screen
        )}
      </IPhoneFrame>
    ) : chromeId === "pixel" ? (
      <PixelFrame
        width={frameWidth}
        color={finish}
        dropShadow={dropShadow}
        {...tilt}
      >
        {isLandscapePhone ? (
          <UprightLandscapeScreen>{screen}</UprightLandscapeScreen>
        ) : (
          screen
        )}
      </PixelFrame>
    ) : (
      <IPadFrame
        width={frameWidth}
        color={finish}
        dropShadow={dropShadow}
        {...tilt}
      >
        {isLandscapePhone ? (
          <UprightLandscapeScreen>{screen}</UprightLandscapeScreen>
        ) : (
          screen
        )}
      </IPadFrame>
    )

  if (!isLandscapePhone) return frame

  // Rotate the same portrait phone chrome into landscape; screenshot stays upright.
  const shortSide = width * portraitAspect
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          width: shortSide,
          height: width,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) rotate(-90deg)",
        }}
      >
        {frame}
      </div>
    </div>
  )
}

/**
 * Keep screenshot upright while the phone chrome is rotated to landscape.
 * Size from the actual screen box (cqw/cqh) so bezels don’t leave a gap.
 */
function UprightLandscapeScreen({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        containerType: "size",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          // Pre-rotate: width = screen height, height = screen width → fills after 90°.
          width: "100cqh",
          height: "100cqw",
          transform: "translate(-50%, -50%) rotate(90deg)",
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function IPhoneFrame({
  width,
  color,
  dropShadow,
  rotationX = 0,
  rotationY = 0,
  thickness,
  children,
}: {
  width: number
  color: string
  dropShadow?: string
  rotationX?: number
  rotationY?: number
  thickness?: number
  children: ReactNode
}) {
  const shell = width * 0.005
  const bezel = width * 0.022
  const outerRadius = width * 0.168
  const bezelRadius = width * 0.158
  const screenRadius = width * 0.146
  const islandW = width * 0.264
  const islandH = width * 0.078
  const buttonT = Math.max(2.5, width * 0.014)
  const chrome = deviceChromeStyles(color, width, "island")
  const depth = chassisDepth(width, "island", thickness)

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        filter: dropShadow,
      }}
    >
      <ChassisDepth
        color={color}
        depth={depth}
        borderRadius={outerRadius}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <SideButton
        side="right"
        top="24.5%"
        length={width * 0.092}
        thickness={buttonT}
        color={color}
        width={width}
        depth={depth}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <SideButton
        side="left"
        top="16.8%"
        length={width * 0.048}
        thickness={buttonT}
        color={color}
        width={width}
        depth={depth}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <SideButton
        side="left"
        top="23.6%"
        length={width * 0.07}
        thickness={buttonT}
        color={color}
        width={width}
        depth={depth}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <SideButton
        side="left"
        top="31.4%"
        length={width * 0.07}
        thickness={buttonT}
        color={color}
        width={width}
        depth={depth}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: outerRadius,
          background: chrome.bodyBackground,
          boxShadow: chrome.bodyBoxShadow,
        }}
      />
      <FrameEdgeShading
        rotationX={rotationX}
        rotationY={rotationY}
        color={color}
        borderRadius={outerRadius}
        width={width}
      />
      {/* Subtle highlight on the front face only */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: outerRadius,
          pointerEvents: "none",
          background: `linear-gradient(135deg, ${tintFrameColor(color, 0.25)} 0%, transparent 32%, transparent 68%, ${shadeFrameColor(color, 0.2)} 100%)`,
          opacity: 0.35,
          mixBlendMode: "overlay",
        }}
      />

      {/* Black glass bezel — stays black regardless of chassis finish */}
      <div
        style={{
          position: "absolute",
          top: shell,
          right: shell,
          bottom: shell,
          left: shell,
          zIndex: 1,
          borderRadius: bezelRadius,
          background: "#000",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: bezel,
          right: bezel,
          bottom: bezel,
          left: bezel,
          zIndex: 1,
          overflow: "hidden",
          borderRadius: screenRadius,
          background: "#000",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 0 1px rgba(0,0,0,0.65)",
        }}
      >
        {children}

        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: width * 0.02,
            width: islandW,
            height: islandH,
            borderRadius: islandH / 2,
            background: "#010101",
            boxShadow:
              "inset 0 1px 1px rgba(255,255,255,0.16), 0 0 0 1px rgba(0,0,0,0.85)",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 2,
          bottom: bezel * 0.32,
          width: width * 0.118,
          height: Math.max(2, width * 0.01),
          borderRadius: 999,
          background: "#0a0a0a",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      />
    </div>
  )
}

function PixelFrame({
  width,
  color,
  dropShadow,
  rotationX = 0,
  rotationY = 0,
  thickness,
  children,
}: {
  width: number
  color: string
  dropShadow?: string
  rotationX?: number
  rotationY?: number
  thickness?: number
  children: ReactNode
}) {
  const shell = width * 0.004
  const bezel = width * 0.018
  const outerRadius = width * 0.12
  const bezelRadius = width * 0.112
  const screenRadius = width * 0.102
  const hole = width * 0.032
  const chrome = deviceChromeStyles(color, width, "punch")
  const depth = chassisDepth(width, "punch", thickness)

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        filter: dropShadow,
      }}
    >
      <ChassisDepth
        color={color}
        depth={depth}
        borderRadius={outerRadius}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <SideButton
        side="right"
        top="22%"
        length={width * 0.1}
        thickness={Math.max(2.5, width * 0.012)}
        color={color}
        width={width}
        depth={depth}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <SideButton
        side="left"
        top="20%"
        length={width * 0.065}
        thickness={Math.max(2.5, width * 0.012)}
        color={color}
        width={width}
        depth={depth}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <SideButton
        side="left"
        top="28%"
        length={width * 0.065}
        thickness={Math.max(2.5, width * 0.012)}
        color={color}
        width={width}
        depth={depth}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: outerRadius,
          background: chrome.bodyBackground,
          boxShadow: chrome.bodyBoxShadow,
        }}
      />
      <FrameEdgeShading
        rotationX={rotationX}
        rotationY={rotationY}
        color={color}
        borderRadius={outerRadius}
        width={width}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: outerRadius,
          pointerEvents: "none",
          background: `linear-gradient(135deg, ${tintFrameColor(color, 0.25)} 0%, transparent 32%, transparent 68%, ${shadeFrameColor(color, 0.2)} 100%)`,
          opacity: 0.35,
          mixBlendMode: "overlay",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: shell,
          right: shell,
          bottom: shell,
          left: shell,
          zIndex: 1,
          borderRadius: bezelRadius,
          background: "#000",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: bezel,
          right: bezel,
          bottom: bezel,
          left: bezel,
          zIndex: 1,
          overflow: "hidden",
          borderRadius: screenRadius,
          background: "#000",
        }}
      >
        {children}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "1.2%",
            transform: "translateX(-50%)",
            borderRadius: "9999px",
            width: hole,
            height: hole,
            background:
              "radial-gradient(circle at 35% 30%, #3d4c5c, #0b0f14 60%, #000)",
            boxShadow: `0 0 0 ${Math.max(2, width * 0.006)}px #111`,
          }}
        />
      </div>
    </div>
  )
}

function IPadFrame({
  width,
  color,
  dropShadow,
  rotationX = 0,
  rotationY = 0,
  thickness,
  children,
}: {
  width: number
  color: string
  dropShadow?: string
  rotationX?: number
  rotationY?: number
  thickness?: number
  children: ReactNode
}) {
  const shell = width * 0.004
  const bezel = width * 0.02
  const outerRadius = width * 0.055
  const bezelRadius = width * 0.048
  const screenRadius = width * 0.038
  const cam = width * 0.014
  const chrome = deviceChromeStyles(color, width, "tablet")
  const depth = chassisDepth(width, "tablet", thickness)

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        filter: dropShadow,
      }}
    >
      <ChassisDepth
        color={color}
        depth={depth}
        borderRadius={outerRadius}
        rotationX={rotationX}
        rotationY={rotationY}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: outerRadius,
          background: chrome.bodyBackground,
          boxShadow: chrome.bodyBoxShadow,
        }}
      />
      <FrameEdgeShading
        rotationX={rotationX}
        rotationY={rotationY}
        color={color}
        borderRadius={outerRadius}
        width={width}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: outerRadius,
          pointerEvents: "none",
          background: `linear-gradient(135deg, ${tintFrameColor(color, 0.25)} 0%, transparent 32%, transparent 68%, ${shadeFrameColor(color, 0.2)} 100%)`,
          opacity: 0.35,
          mixBlendMode: "overlay",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: shell,
          right: shell,
          bottom: shell,
          left: shell,
          zIndex: 1,
          borderRadius: bezelRadius,
          background: "#000",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: bezel,
          right: bezel,
          bottom: bezel,
          left: bezel,
          zIndex: 1,
          overflow: "hidden",
          borderRadius: screenRadius,
          background: "#000",
        }}
      >
        {children}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "0.55%",
            transform: "translateX(-50%)",
            borderRadius: "9999px",
            width: cam,
            height: cam,
            background:
              "radial-gradient(circle at 35% 30%, #4a5a6a, #111 65%)",
          }}
        />
      </div>
    </div>
  )
}

/** How much narrower the back face is than the front (perspective hint). */
const CHASSIS_TAPER = 0.006

/** Local-space shift of the back face for a given tilt (0 when facing camera). */
function chassisDepthOffset(
  rotationX: number,
  rotationY: number,
  depth: number,
): { ox: number; oy: number } | null {
  if (Math.abs(rotationX) < 3 && Math.abs(rotationY) < 3) return null

  const clamp = (rad: number) =>
    Math.tan(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, rad)))
  const ox = -clamp((rotationY * Math.PI) / 180) * depth
  const oy = clamp((rotationX * Math.PI) / 180) * depth
  if (Math.abs(ox) < 0.6 && Math.abs(oy) < 0.6) return null
  return { ox, oy }
}

/**
 * Side wall behind the front face. Every layer keeps the phone silhouette and
 * tapers slightly, so the back never reads wider than the front.
 */
function ChassisDepth({
  color,
  depth,
  borderRadius,
  rotationX,
  rotationY,
}: {
  color: string
  depth: number
  borderRadius: number
  rotationX: number
  rotationY: number
}) {
  const offset = chassisDepthOffset(rotationX, rotationY, depth)
  if (!offset) return null
  const { ox, oy } = offset
  const steps = 10

  return (
    <>
      {Array.from({ length: steps }, (_, i) => {
        const t = (i + 1) / steps
        return (
          <div
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              transform: `translate(${ox * t}px, ${oy * t}px) scale(${1 - t * CHASSIS_TAPER})`,
              borderRadius,
              background: shadeFrameColor(color, 0.1 + t * 0.45),
              pointerEvents: "none",
            }}
          />
        )
      })}
    </>
  )
}

/**
 * Directional lip on the front face. Uses inset shadows so the highlight
 * follows the rounded corners instead of poking out past them.
 */
function FrameEdgeShading({
  rotationX,
  rotationY,
  color,
  borderRadius,
  width,
}: {
  rotationX: number
  rotationY: number
  color: string
  borderRadius: number
  width: number
}) {
  const absX = Math.abs(rotationX)
  const absY = Math.abs(rotationY)
  if (absX < 3 && absY < 3) return null

  const lip = Math.max(1.5, width * 0.007)
  const horizontal = absY >= absX
  const dx = horizontal ? (rotationY > 0 ? 1 : -1) : 0
  const dy = horizontal ? 0 : rotationX > 0 ? 1 : -1
  const light = tintFrameColor(color, 0.5)
  const dark = shadeFrameColor(color, 0.45)
  const feather = lip * 0.4

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        borderRadius,
        pointerEvents: "none",
        boxShadow: [
          `inset ${dx * lip}px ${dy * lip}px 0 -${feather}px ${light}`,
          `inset ${-dx * lip}px ${-dy * lip}px 0 -${feather}px ${dark}`,
        ].join(", "),
      }}
    />
  )
}

/**
 * Machined side button: protrudes a hair past the chassis, tucks the rest of
 * itself under the body so the join has no seam, and sweeps through the phone's
 * thickness under tilt so it reads as a bar on the side wall, not a floating tab.
 */
function SideButton({
  side,
  top,
  length,
  thickness,
  color,
  width,
  depth,
  rotationX = 0,
  rotationY = 0,
}: {
  side: "left" | "right" | "top" | "bottom"
  /** Offset along the long axis (top% for left/right, left% for top/bottom). */
  top: string
  length: number
  thickness: number
  color: string
  width: number
  depth: number
  rotationX?: number
  rotationY?: number
}) {
  const facingAway =
    (side === "left" && rotationY < -4) ||
    (side === "right" && rotationY > 4) ||
    (side === "top" && rotationX > 4) ||
    (side === "bottom" && rotationX < -4)
  if (facingAway) return null

  const vertical = side === "top" || side === "bottom"
  // Only a sliver stands proud of the chassis; the rest hides under the body.
  const protrude = Math.max(1, thickness * 0.3)
  const buried = Math.max(2, thickness * 0.9)
  const across = protrude + buried
  const radius = Math.max(1, width * 0.0035)

  const offset = chassisDepthOffset(rotationX, rotationY, depth)
  // Button sits inside the thickness, not flush with either face.
  const near = 0.24
  const far = 0.72
  const steps = offset ? 8 : 0
  // Follow the wall's taper inward so the nub never overhangs its edge.
  const inward = side === "left" || side === "top" ? 1 : -1
  const creep = (t: number) => width * (CHASSIS_TAPER / 2) * t * inward

  const faceGradient = (() => {
    const lip = shadeFrameColor(color, 0.32)
    const hi = tintFrameColor(color, 0.5)
    const seam = shadeFrameColor(color, 0.5)
    const angle =
      side === "left"
        ? 90
        : side === "right"
          ? 270
          : side === "top"
            ? 180
            : 0
    return `linear-gradient(${angle}deg, ${lip} 0%, ${hi} 28%, ${color} 58%, ${seam} 100%)`
  })()

  const endCaps = vertical
    ? "inset 1px 0 1.5px rgba(0,0,0,0.35), inset -1px 0 1.5px rgba(0,0,0,0.35)"
    : "inset 0 1px 1.5px rgba(0,0,0,0.35), inset 0 -1px 1.5px rgba(0,0,0,0.35)"

  const box = vertical
    ? {
        [side]: -protrude,
        left: top,
        width: length,
        height: across,
      }
    : {
        [side]: -protrude,
        top,
        width: across,
        height: length,
      }

  const layer = (t: number, background: string, shadow?: string) => (
    <div
      key={t}
      aria-hidden
      style={{
        position: "absolute",
        zIndex: 0,
        pointerEvents: "none",
        ...box,
        borderRadius: radius,
        background,
        boxShadow: shadow,
        transform: offset
          ? `translate(${offset.ox * t + (vertical ? 0 : creep(t))}px, ${
              offset.oy * t + (vertical ? creep(t) : 0)
            }px)`
          : undefined,
      }}
    />
  )

  return (
    <>
      {Array.from({ length: steps }, (_, i) => {
        const t = far - ((far - near) * i) / steps
        return layer(t, shadeFrameColor(color, 0.18 + t * 0.4))
      })}
      {layer(near, faceGradient, `${endCaps}, 0 0 2px rgba(0,0,0,0.4)`)}
    </>
  )
}

function ScreenDropTarget({
  slot,
  interactive,
  children,
}: {
  slot: "a" | "b"
  interactive?: boolean
  children: ReactNode
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      data-screen-slot={slot}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        outline:
          interactive && over ? "2px solid rgba(139, 92, 246, 0.9)" : undefined,
        outlineOffset: interactive && over ? -2 : undefined,
        background:
          interactive && over ? "rgba(139, 92, 246, 0.12)" : undefined,
      }}
      onDragEnter={(event) => {
        if (!interactive || !event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        event.stopPropagation()
        setOver(true)
      }}
      onDragOver={(event) => {
        if (!interactive || !event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = "copy"
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setOver(false)
      }}
      onDrop={() => setOver(false)}
    >
      {children}
    </div>
  )
}

function ScreenContent({
  screenshotUrl,
  screenshotUrlB,
  screenMode,
  screenSplitAngle,
  screenSplitRatio,
  imageFit = "cover",
  interactive,
  onUploadClick,
}: {
  screenshotUrl: string | null
  screenshotUrlB?: string | null
  screenMode?: "single" | "split"
  screenSplitAngle?: number
  screenSplitRatio?: number
  imageFit?: "cover" | "contain"
  interactive?: boolean
  onUploadClick?: (slot?: "a" | "b") => void
}) {
  const split =
    screenMode === "split" || Boolean(screenshotUrlB && screenshotUrlB !== screenshotUrl)
  const angle = ((screenSplitAngle ?? 90) % 360 + 360) % 360
  const ratio = Math.min(95, Math.max(5, screenSplitRatio ?? 50))

  if (!split) {
    return (
      <ScreenDropTarget slot="a" interactive={interactive}>
        {screenshotUrl ? (
          <ScreenImage src={screenshotUrl} fit={imageFit} />
        ) : (
          <ScreenEmpty
            interactive={interactive}
            onUploadClick={() => onUploadClick?.("a")}
          />
        )}
      </ScreenDropTarget>
    )
  }

  // Full-screen images + gradient masks (same convention as CSS linear-gradient).
  const maskA = `linear-gradient(${angle}deg, #000 0 ${ratio}%, transparent ${ratio}% 100%)`
  const maskB = `linear-gradient(${angle}deg, transparent 0 ${ratio}%, #000 ${ratio}% 100%)`

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MaskedPane mask={maskA}>
        <ScreenDropTarget slot="a" interactive={interactive}>
          {screenshotUrl ? (
            <ScreenImage src={screenshotUrl} fit={imageFit} />
          ) : (
            <ScreenEmpty
              interactive={interactive}
              label="A"
              onUploadClick={() => onUploadClick?.("a")}
            />
          )}
        </ScreenDropTarget>
      </MaskedPane>
      <MaskedPane mask={maskB}>
        <ScreenDropTarget slot="b" interactive={interactive}>
          {screenshotUrlB ? (
            <ScreenImage src={screenshotUrlB} fit={imageFit} />
          ) : (
            <ScreenEmpty
              interactive={interactive}
              label="B"
              onUploadClick={() => onUploadClick?.("b")}
            />
          )}
        </ScreenDropTarget>
      </MaskedPane>
      <SplitDivider angle={angle} ratio={ratio} />
    </div>
  )
}

function MaskedPane({ mask, children }: { mask: string; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {children}
    </div>
  )
}

/** Thin line along the hard edge of the angled split. */
function SplitDivider({ angle, ratio }: { angle: number; ratio: number }) {
  // CSS gradient direction (y down): (sin θ, −cos θ). Iso-line is perpendicular.
  const rad = (angle * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  // Edge passes near center, shifted along the gradient by (ratio − 50)%.
  const cx = 50 + dx * (ratio - 50)
  const cy = 50 + dy * (ratio - 50)
  // Line direction perpendicular to gradient
  const lx = Math.cos(rad)
  const ly = Math.sin(rad)
  const extent = 150
  const x1 = cx - lx * extent
  const y1 = cy - ly * extent
  const x2 = cx + lx * extent
  const y2 = cy + ly * extent

  return (
    <svg
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
        overflow: "visible",
      }}
    >
      <line
        x1={`${x1}%`}
        y1={`${y1}%`}
        x2={`${x2}%`}
        y2={`${y2}%`}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function ScreenImage({
  src,
  fit = "cover",
}: {
  src: string
  fit?: "cover" | "contain"
}) {
  return (
    <img
      src={src}
      alt="App screenshot"
      draggable={false}
      crossOrigin={src.startsWith("http") ? "anonymous" : undefined}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: fit,
        objectPosition: "center center",
        background: "#0a0a0a",
        pointerEvents: "none",
      }}
    />
  )
}

function ScreenEmpty({
  interactive,
  onUploadClick,
  label,
}: {
  interactive?: boolean
  onUploadClick?: () => void
  label?: string
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#1c1c1e] px-4 text-center">
      <div className="flex w-[58%] flex-col gap-2 opacity-40">
        <div className="h-2 w-1/3 rounded bg-white/50" />
        <div className="h-16 rounded-lg bg-white/15" />
        <div className="h-8 rounded-lg bg-white/10" />
        <div className="h-8 rounded-lg bg-white/10" />
      </div>
      {interactive ? (
        <button
          type="button"
          onClick={onUploadClick}
          className="rounded-full bg-white/10 px-3 py-1.5 text-[0.65em] font-medium tracking-wide text-white/80 hover:bg-white/20"
        >
          {label ? `Add ${label}` : "Drop or click to add a screenshot"}
        </button>
      ) : (
        <span className="text-[0.7em] font-medium tracking-wide text-white/45">
          No screenshot
        </span>
      )}
    </div>
  )
}
