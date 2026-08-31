import { useEffect, type PointerEvent } from "react"
import { deviceSpec } from "../constants"
import { flattenedDeviceTransform } from "../device-transform"
import { layerFlipCss } from "../layer-flip"
import type { ClipartLayer, Frame } from "../types"
import { ClipartVisual } from "./ClipartVisual"
import { ResizeHandles, type ResizeHandle } from "./ResizeHandles"

type PlacedClipartProps = {
  clipart: ClipartLayer
  frame?: Frame | null
  artboardWidth: number
  artboardHeight: number
  imageUrl: string | null
  selected: boolean
  zIndex: number
  interactive: boolean
  forExport?: boolean
  canvasScale?: number
  onPointerDown?: (clipartId: string, event: PointerEvent<HTMLDivElement>) => void
  onResizeStart?: (
    clipartId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onAspectChange?: (clipartId: string, aspect: number) => void
}

export function PlacedClipart({
  clipart,
  frame = null,
  artboardWidth,
  artboardHeight,
  imageUrl,
  selected,
  zIndex,
  interactive,
  forExport = false,
  canvasScale = 1,
  onPointerDown,
  onResizeStart,
  onAspectChange,
}: PlacedClipartProps) {
  const aspect =
    Number.isFinite(clipart.aspect) && clipart.aspect > 0 ? clipart.aspect : 1
  const attached = Boolean(frame && clipart.attachedFrameId === frame.id)

  useEffect(() => {
    if (!imageUrl || !onAspectChange) return
    if (Math.abs(aspect - 1) > 0.001) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const next =
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? img.naturalWidth / img.naturalHeight
          : 1
      if (Math.abs(next - 1) > 0.02) {
        onAspectChange(clipart.id, next)
      }
    }
    img.src = imageUrl
    return () => {
      cancelled = true
    }
  }, [imageUrl, clipart.id, aspect, onAspectChange])

  if (attached && frame) {
    const spec = deviceSpec(frame.deviceId)
    const deviceWidth = artboardWidth * frame.scale
    const deviceHeight = deviceWidth / spec.aspect
    const centerX = (frame.x / 100) * artboardWidth
    const centerY = (frame.y / 100) * artboardHeight
    const deviceTransform = `${flattenedDeviceTransform(
      frame.rotationX,
      frame.rotationY,
      frame.rotation,
      artboardWidth,
    )}${layerFlipCss(frame.flipH, frame.flipV)}`
    const clipartWidth = (clipart.width / 100) * deviceWidth
    const clipartHeight = clipartWidth / aspect
    const localX =
      deviceWidth / 2 + (clipart.x / 100) * deviceWidth - clipartWidth / 2
    const localY =
      deviceHeight / 2 + (clipart.y / 100) * deviceHeight - clipartHeight / 2

    return (
      <div
        style={{
          position: "absolute",
          left: centerX - deviceWidth / 2,
          top: centerY - deviceHeight / 2,
          width: deviceWidth,
          height: deviceHeight,
          transform: deviceTransform,
          transformOrigin: "center center",
          zIndex,
          pointerEvents: "none",
        }}
      >
        <div
          data-clipart-id={clipart.id}
          style={{
            position: "absolute",
            left: localX,
            top: localY,
            width: clipartWidth,
            height: clipartHeight,
            transform: `${flattenedDeviceTransform(
              clipart.rotationX ?? 0,
              clipart.rotationY ?? 0,
              clipart.rotation,
              artboardWidth,
            )}${layerFlipCss(clipart.flipH, clipart.flipV)}`,
            transformOrigin: "center center",
            transformStyle: "flat",
            cursor: interactive ? "grab" : "default",
            touchAction: interactive ? "none" : undefined,
            outline:
              !forExport && selected
                ? `${Math.max(2, artboardWidth * 0.003)}px solid #e8ff47`
                : undefined,
            outlineOffset: Math.max(4, artboardWidth * 0.004),
            pointerEvents: interactive ? "auto" : "none",
          }}
          onPointerDown={
            interactive
              ? (event) => onPointerDown?.(clipart.id, event)
              : undefined
          }
        >
          {imageUrl ? (
            <ClipartVisual
              clipart={clipart}
              imageUrl={imageUrl}
              forExport={forExport}
            />
          ) : null}
          {!forExport && selected && interactive && onResizeStart ? (
            <ResizeHandles
              artboardWidth={artboardWidth}
              canvasScale={canvasScale}
              onResizeStart={(handle, event) =>
                onResizeStart(clipart.id, handle, event)
              }
            />
          ) : null}
        </div>
      </div>
    )
  }

  const clipartWidth = (clipart.width / 100) * artboardWidth
  const clipartHeight = clipartWidth / aspect
  const centerX = (clipart.x / 100) * artboardWidth
  const centerY = (clipart.y / 100) * artboardHeight

  return (
    <div
      data-clipart-id={clipart.id}
      style={{
        position: "absolute",
        left: centerX - clipartWidth / 2,
        top: centerY - clipartHeight / 2,
        width: clipartWidth,
        height: clipartHeight,
        transform: `${flattenedDeviceTransform(
          clipart.rotationX ?? 0,
          clipart.rotationY ?? 0,
          clipart.rotation,
          artboardWidth,
        )}${layerFlipCss(clipart.flipH, clipart.flipV)}`,
        transformOrigin: "center center",
        transformStyle: "flat",
        isolation: "isolate",
        zIndex,
        cursor: interactive ? "grab" : "default",
        touchAction: interactive ? "none" : undefined,
        outline:
          !forExport && selected
            ? `${Math.max(2, artboardWidth * 0.003)}px solid #e8ff47`
            : undefined,
        outlineOffset: Math.max(4, artboardWidth * 0.004),
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={
        interactive
          ? (event) => onPointerDown?.(clipart.id, event)
          : undefined
      }
    >
      {imageUrl ? (
        <ClipartVisual
          clipart={clipart}
          imageUrl={imageUrl}
          forExport={forExport}
        />
      ) : null}
      {!forExport && selected && interactive && onResizeStart ? (
        <ResizeHandles
          artboardWidth={artboardWidth}
          canvasScale={canvasScale}
          onResizeStart={(handle, event) =>
            onResizeStart(clipart.id, handle, event)
          }
        />
      ) : null}
    </div>
  )
}
