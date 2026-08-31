import type { PointerEvent } from "react"
import { deviceSpec } from "../constants"
import { flattenedDeviceTransform } from "../device-transform"
import { layerFlipCss } from "../layer-flip"
import type { Frame, FrameScreenSlot } from "../types"
import { DeviceFrame } from "./DeviceFrame"
import { ResizeHandles, type ResizeHandle } from "./ResizeHandles"

type PlacedDeviceProps = {
  frame: Frame
  width: number
  height: number
  screenshotUrl: string | null
  screenshotUrlB?: string | null
  selected: boolean
  zIndex: number
  isGuest?: boolean
  interactive?: boolean
  forExport?: boolean
  canvasScale?: number
  onPointerDown?: (frameId: string, event: PointerEvent<HTMLDivElement>) => void
  onResizeStart?: (
    frameId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onUploadClick?: (frameId: string, slot?: FrameScreenSlot) => void
}

export function PlacedDevice({
  frame,
  width,
  height,
  screenshotUrl,
  screenshotUrlB = null,
  selected,
  zIndex,
  isGuest = false,
  interactive = false,
  forExport = false,
  canvasScale = 1,
  onPointerDown,
  onResizeStart,
  onUploadClick,
}: PlacedDeviceProps) {
  const spec = deviceSpec(frame.deviceId)
  const deviceWidth = width * frame.scale
  const deviceHeight = deviceWidth / spec.aspect
  const centerX = (frame.x / 100) * width
  const centerY = (frame.y / 100) * height
  const transform = `${flattenedDeviceTransform(
    frame.rotationX,
    frame.rotationY,
    frame.rotation,
    width,
  )}${layerFlipCss(frame.flipH, frame.flipV)}`

  return (
    <div
      data-frame-id={frame.id}
      data-guest-frame={isGuest ? "true" : undefined}
      style={{
        position: "absolute",
        left: centerX - deviceWidth / 2,
        top: centerY - deviceHeight / 2,
        width: deviceWidth,
        height: deviceHeight,
        transform,
        transformOrigin: "center center",
        transformStyle: "flat",
        isolation: "isolate",
        zIndex,
        cursor: interactive ? "grab" : "default",
        touchAction: interactive ? "none" : undefined,
        pointerEvents: interactive ? "auto" : "none",
        outline:
          !forExport && selected
            ? `${Math.max(3, width * 0.004)}px solid #e8ff47`
            : undefined,
        outlineOffset: Math.max(4, width * 0.006),
      }}
      onPointerDown={
        interactive ? (event) => onPointerDown?.(frame.id, event) : undefined
      }
    >
      <DeviceFrame
        deviceId={frame.deviceId}
        width={deviceWidth}
        color={frame.color}
        screenshotUrl={screenshotUrl}
        screenshotUrlB={screenshotUrlB}
        screenMode={frame.screenMode}
        screenSplitAngle={frame.screenSplitAngle}
        screenSplitRatio={frame.screenSplitRatio}
        interactive={interactive}
        shadow={frame.shadow ?? 24}
        shadowOffsetX={frame.shadowOffsetX ?? 0}
        shadowOffsetY={frame.shadowOffsetY ?? 8}
        shadowOpacity={frame.shadowOpacity ?? 55}
        shadowColor={frame.shadowColor ?? "#000000"}
        rotationX={frame.rotationX}
        rotationY={frame.rotationY}
        thickness={frame.thickness}
        onUploadClick={(slot) => onUploadClick?.(frame.id, slot)}
      />
      {!forExport && selected && interactive && onResizeStart ? (
        <ResizeHandles
          artboardWidth={width}
          canvasScale={canvasScale}
          onResizeStart={(handle, event) =>
            onResizeStart(frame.id, handle, event)
          }
        />
      ) : null}
    </div>
  )
}
