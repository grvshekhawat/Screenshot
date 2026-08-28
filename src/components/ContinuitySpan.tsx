import type { PointerEvent } from "react"
import type { ClipartLayer, Frame, FrameScreenSlot } from "../types"
import { ClipartVisual } from "./ClipartVisual"
import { PlacedClipart } from "./PlacedClipart"
import { PlacedDevice } from "./PlacedDevice"
import { ResizeHandles, type ResizeHandle } from "./ResizeHandles"

export const SLIDE_GAP_PX = 16

type ContinuitySpanProps = {
  frame: Frame
  attachedCliparts?: {
    clipart: ClipartLayer
    imageUrl: string | null
    selected: boolean
    zIndex: number
  }[]
  ownerSlideIndex: number
  clipIndices: number[]
  artboardWidth: number
  artboardHeight: number
  previewSlideWidth: number
  previewSlideHeight: number
  scale: number
  screenshotUrl: string | null
  screenshotUrlB?: string | null
  selected: boolean
  zIndex: number
  interactive?: boolean
  onPointerDown?: (frameId: string, event: PointerEvent<HTMLDivElement>) => void
  onResizeStart?: (
    frameId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onUploadClick?: (frameId: string, slot?: FrameScreenSlot) => void
  onClipartPointerDown?: (
    clipartId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onClipartResizeStart?: (
    clipartId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
}

/** Same device per touched slide, each clipped to its card boundary. */
export function ContinuitySpan({
  frame,
  attachedCliparts = [],
  ownerSlideIndex,
  clipIndices,
  artboardWidth,
  artboardHeight,
  previewSlideWidth,
  previewSlideHeight,
  scale,
  screenshotUrl,
  screenshotUrlB = null,
  selected,
  zIndex,
  interactive = false,
  onPointerDown,
  onResizeStart,
  onUploadClick,
  onClipartPointerDown,
  onClipartResizeStart,
}: ContinuitySpanProps) {
  const step = previewSlideWidth + SLIDE_GAP_PX

  return (
    <>
      {clipIndices.map((clipIndex) => (
        <div
          key={clipIndex}
          data-continuity-span
          className="pointer-events-none absolute overflow-clip"
          style={{
            left: clipIndex * step,
            top: 0,
            width: previewSlideWidth,
            height: previewSlideHeight,
            zIndex: 40 + zIndex,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: (ownerSlideIndex - clipIndex) * step,
              top: 0,
              width: previewSlideWidth,
              height: previewSlideHeight,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: artboardWidth,
                height: artboardHeight,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <PlacedDevice
                frame={frame}
                width={artboardWidth}
                height={artboardHeight}
                screenshotUrl={screenshotUrl}
                screenshotUrlB={screenshotUrlB}
                selected={selected}
                zIndex={zIndex}
                interactive={interactive}
                canvasScale={scale}
                onPointerDown={onPointerDown}
                onResizeStart={onResizeStart}
                onUploadClick={onUploadClick}
              />
              {attachedCliparts.map((item) => (
                <PlacedClipart
                  key={item.clipart.id}
                  clipart={item.clipart}
                  frame={frame}
                  artboardWidth={artboardWidth}
                  artboardHeight={artboardHeight}
                  imageUrl={item.imageUrl}
                  selected={item.selected}
                  zIndex={item.zIndex}
                  interactive={interactive}
                  canvasScale={scale}
                  onPointerDown={onClipartPointerDown}
                  onResizeStart={onClipartResizeStart}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

type ContinuityClipartSpanProps = {
  clipart: ClipartLayer
  ownerSlideIndex: number
  clipIndices: number[]
  artboardWidth: number
  artboardHeight: number
  previewSlideWidth: number
  previewSlideHeight: number
  scale: number
  imageUrl: string | null
  selected: boolean
  zIndex: number
  interactive?: boolean
  onPointerDown?: (
    clipartId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onResizeStart?: (
    clipartId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
}

/** Same clipart per touched slide — one size/position, clipped per card (gap-aware). */
export function ContinuityClipartSpan({
  clipart,
  ownerSlideIndex,
  clipIndices,
  artboardWidth,
  artboardHeight,
  previewSlideWidth,
  previewSlideHeight,
  scale,
  imageUrl,
  selected,
  zIndex,
  interactive = false,
  onPointerDown,
  onResizeStart,
}: ContinuityClipartSpanProps) {
  const step = previewSlideWidth + SLIDE_GAP_PX
  const aspect =
    Number.isFinite(clipart.aspect) && clipart.aspect > 0 ? clipart.aspect : 1
  const clipartWidth = (clipart.width / 100) * artboardWidth
  const clipartHeight = clipartWidth / aspect
  const centerX = (clipart.x / 100) * artboardWidth
  const centerY = (clipart.y / 100) * artboardHeight

  return (
    <>
      {clipIndices.map((clipIndex) => (
        <div
          key={clipIndex}
          data-continuity-span
          className="pointer-events-none absolute overflow-clip"
          style={{
            left: clipIndex * step,
            top: 0,
            width: previewSlideWidth,
            height: previewSlideHeight,
            zIndex: 40 + zIndex,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: (ownerSlideIndex - clipIndex) * step,
              top: 0,
              width: previewSlideWidth,
              height: previewSlideHeight,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: artboardWidth,
                height: artboardHeight,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <div
                data-clipart-id={clipart.id}
                style={{
                  position: "absolute",
                  left: centerX - clipartWidth / 2,
                  top: centerY - clipartHeight / 2,
                  width: clipartWidth,
                  height: clipartHeight,
                  transform: `rotate(${clipart.rotation}deg)`,
                  transformOrigin: "center center",
                  zIndex,
                  cursor: interactive ? "grab" : "default",
                  touchAction: interactive ? "none" : undefined,
                  pointerEvents: interactive ? "auto" : "none",
                  outline: selected
                    ? `${Math.max(2, artboardWidth * 0.003)}px solid #8b5cf6`
                    : undefined,
                  outlineOffset: Math.max(4, artboardWidth * 0.004),
                }}
                onPointerDown={
                  interactive
                    ? (event) => onPointerDown?.(clipart.id, event)
                    : undefined
                }
              >
                {imageUrl ? (
                  <ClipartVisual clipart={clipart} imageUrl={imageUrl} />
                ) : null}
                {selected && interactive && onResizeStart ? (
                  <ResizeHandles
                    artboardWidth={artboardWidth}
                    canvasScale={scale}
                    onResizeStart={(handle, event) =>
                      onResizeStart(clipart.id, handle, event)
                    }
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
