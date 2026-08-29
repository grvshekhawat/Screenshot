import { useState, type ReactNode } from "react"
import { deviceShadowCss } from "../constants"
import type { DeviceId } from "../types"

type DeviceFrameProps = {
  deviceId: DeviceId
  width: number
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
  onUploadClick?: (slot?: "a" | "b") => void
}

export function DeviceFrame({
  deviceId,
  width,
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
  })

  const frame =
    chromeId === "iphone-69" ? (
      <IPhoneFrame
        width={isLandscapePhone ? width * portraitAspect : width}
        dropShadow={dropShadow}
      >
        {isLandscapePhone ? (
          <UprightLandscapeScreen>{screen}</UprightLandscapeScreen>
        ) : (
          screen
        )}
      </IPhoneFrame>
    ) : chromeId === "pixel" ? (
      <PixelFrame
        width={isLandscapePhone ? width * portraitAspect : width}
        dropShadow={dropShadow}
      >
        {isLandscapePhone ? (
          <UprightLandscapeScreen>{screen}</UprightLandscapeScreen>
        ) : (
          screen
        )}
      </PixelFrame>
    ) : (
      <IPadFrame
        width={isLandscapePhone ? width * portraitAspect : width}
        dropShadow={dropShadow}
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
  dropShadow,
  children,
}: {
  width: number
  dropShadow?: string
  children: ReactNode
}) {
  const bezel = width * 0.038
  const outerRadius = width * 0.168
  const screenRadius = width * 0.128
  const islandW = width * 0.264
  const islandH = width * 0.078
  const rim = Math.max(1.5, width * 0.007)
  const buttonT = Math.max(3, width * 0.018)

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        filter: dropShadow,
      }}
    >
      <SideButton
        side="right"
        top="24.5%"
        length={width * 0.092}
        thickness={buttonT}
        lightFrom="left"
      />
      <SideButton
        side="left"
        top="16.8%"
        length={width * 0.048}
        thickness={buttonT}
        lightFrom="right"
      />
      <SideButton
        side="left"
        top="23.6%"
        length={width * 0.07}
        thickness={buttonT}
        lightFrom="right"
      />
      <SideButton
        side="left"
        top="31.4%"
        length={width * 0.07}
        thickness={buttonT}
        lightFrom="right"
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: outerRadius,
          background:
            "linear-gradient(90deg, #5c5c62 0%, #1a1a1c 7%, #111113 18%, #161618 50%, #111113 82%, #1a1a1c 93%, #5c5c62 100%)",
          boxShadow: `
            0 0 0 ${Math.max(1, width * 0.0025)}px #050505,
            inset 0 0 0 ${Math.max(1, width * 0.003)}px rgba(255,255,255,0.28),
            inset 0 ${width * 0.01}px ${width * 0.018}px rgba(255,255,255,0.08),
            inset 0 0 0 ${rim}px #2a2a2e,
            inset 0 0 0 ${rim + Math.max(1, width * 0.004)}px #0b0b0d
          `,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: bezel,
          right: bezel,
          bottom: bezel,
          left: bezel,
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
  dropShadow,
  children,
}: {
  width: number
  dropShadow?: string
  children: ReactNode
}) {
  const bezel = width * 0.03
  const outerRadius = width * 0.12
  const screenRadius = width * 0.095
  const hole = width * 0.032

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        filter: dropShadow,
      }}
    >
      <SideButton
        side="right"
        top="22%"
        length={width * 0.1}
        thickness={Math.max(3, width * 0.016)}
        lightFrom="left"
      />
      <SideButton
        side="left"
        top="20%"
        length={width * 0.065}
        thickness={Math.max(3, width * 0.016)}
        lightFrom="right"
      />
      <SideButton
        side="left"
        top="28%"
        length={width * 0.065}
        thickness={Math.max(3, width * 0.016)}
        lightFrom="right"
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: outerRadius,
          background:
            "linear-gradient(90deg, #4a4a4c 0%, #2a2a2c 10%, #1c1c1e 50%, #2a2a2c 90%, #4a4a4c 100%)",
          boxShadow: `inset 0 0 0 ${Math.max(1, width * 0.004)}px rgba(255,255,255,0.18), inset 0 0 0 ${width * 0.012}px #111`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: bezel,
          right: bezel,
          bottom: bezel,
          left: bezel,
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
  dropShadow,
  children,
}: {
  width: number
  dropShadow?: string
  children: ReactNode
}) {
  const bezel = width * 0.032
  const outerRadius = width * 0.055
  const screenRadius = width * 0.032
  const cam = width * 0.014

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        filter: dropShadow,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: outerRadius,
          background:
            "linear-gradient(90deg, #6d6d72 0%, #3a3a3c 12%, #2c2c2e 50%, #3a3a3c 88%, #6d6d72 100%)",
          boxShadow: `inset 0 0 0 ${Math.max(1, width * 0.003)}px rgba(255,255,255,0.25), inset 0 0 0 ${width * 0.01}px #1c1c1e`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: bezel,
          right: bezel,
          bottom: bezel,
          left: bezel,
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

function SideButton({
  side,
  top,
  length,
  thickness,
  lightFrom,
}: {
  side: "left" | "right" | "top" | "bottom"
  /** Offset along the long axis (top% for left/right, left% for top/bottom). */
  top: string
  length: number
  thickness: number
  lightFrom: "left" | "right"
}) {
  const gradient =
    lightFrom === "left"
      ? "linear-gradient(90deg, #8a8a90, #3e3e42 40%, #1c1c1e)"
      : "linear-gradient(90deg, #1c1c1e, #3e3e42 60%, #8a8a90)"
  const vertical = side === "top" || side === "bottom"

  return (
    <div
      style={{
        position: "absolute",
        ...(vertical
          ? {
              [side]: -thickness + 1,
              left: top,
              width: length,
              height: thickness,
              background:
                lightFrom === "left"
                  ? "linear-gradient(180deg, #8a8a90, #3e3e42 40%, #1c1c1e)"
                  : "linear-gradient(180deg, #1c1c1e, #3e3e42 60%, #8a8a90)",
            }
          : {
              [side]: -thickness + 1,
              top,
              width: thickness,
              height: length,
              background: gradient,
            }),
        borderRadius: thickness * 0.4,
        boxShadow:
          side === "right" || side === "bottom"
            ? "1px 1px 2px rgba(0,0,0,0.45)"
            : "-1px 1px 2px rgba(0,0,0,0.45)",
      }}
    />
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
