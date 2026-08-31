import type { PointerEvent } from "react"
import { lensShadowCss } from "../constants"
import { flattenedDeviceTransform } from "../device-transform"
import { layerFlipCss } from "../layer-flip"
import type { LensLayer, Slide } from "../types"
import {
  guestClipartsForSlide,
  guestFramesForSlide,
  type GuestClipart,
  type GuestFrame,
} from "../overflow"
import { Artboard } from "./Artboard"
import { ResizeHandles, type ResizeHandle } from "./ResizeHandles"

export function lensPixelSize(
  lens: LensLayer,
  artboardWidth: number,
  artboardHeight: number,
) {
  return {
    width: (lens.width / 100) * artboardWidth,
    height: (lens.height / 100) * artboardHeight,
  }
}

type PlacedLensProps = {
  lens: LensLayer
  slide: Slide
  slides?: Slide[]
  width: number
  height: number
  assetUrls: Record<string, string>
  guestFrames?: GuestFrame[]
  guestCliparts?: GuestClipart[]
  selected: boolean
  zIndex: number
  interactive?: boolean
  forExport?: boolean
  canvasScale?: number
  onPointerDown?: (lensId: string, event: PointerEvent<HTMLDivElement>) => void
  onResizeStart?: (
    lensId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
}

/** Magnifier overlay — clones the slide (without lenses) scaled into the shape. */
export function PlacedLens({
  lens,
  slide,
  slides,
  width,
  height,
  assetUrls,
  guestFrames = [],
  guestCliparts = [],
  selected,
  zIndex,
  interactive = false,
  forExport = false,
  canvasScale = 1,
  onPointerDown,
  onResizeStart,
}: PlacedLensProps) {
  const { width: lensW, height: lensH } = lensPixelSize(lens, width, height)
  const frameCx = (lens.x / 100) * width
  const frameCy = (lens.y / 100) * height
  const isImageLocked = lens.imageLocked || Boolean(lens.lockedImageId)
  const anchorX = isImageLocked ? lens.lockedX : lens.x
  const anchorY = isImageLocked ? lens.lockedY : lens.y
  const contentCx = (anchorX / 100) * width
  const contentCy = (anchorY / 100) * height
  const zoom = lens.zoom
  const radius = `${(lens.cornerRadius / 100) * Math.min(lensW, lensH)}px`
  const border = Math.max(0, lens.borderWidth)
  const dropShadow = lensShadowCss(lens)
  const slideIndex = slides?.findIndex((entry) => entry.id === slide.id) ?? -1
  const contentGuests: GuestFrame[] =
    slides && slideIndex >= 0
      ? guestFramesForSlide(slides, slideIndex, width, height)
      : guestFrames
  const contentGuestCliparts: GuestClipart[] =
    slides && slideIndex >= 0
      ? guestClipartsForSlide(slides, slideIndex, width, height)
      : guestCliparts
  const lockedImageUrl = lens.lockedImageId
    ? (assetUrls[lens.lockedImageId] ?? null)
    : null
  const showLockedSnapshot = isImageLocked && Boolean(lockedImageUrl)

  return (
    <div
      data-lens-id={lens.id}
      style={{
        position: "absolute",
        left: frameCx - lensW / 2,
        top: frameCy - lensH / 2,
        width: lensW,
        height: lensH,
        borderRadius: radius,
        // Shadow on the outer shell — overflow:hidden would clip it.
        boxShadow: dropShadow,
        transform: `${flattenedDeviceTransform(
          lens.rotationX ?? 0,
          lens.rotationY ?? 0,
          lens.rotation ?? 0,
          width,
        )}${layerFlipCss(lens.flipH, lens.flipV)}`,
        transformOrigin: "center center",
        transformStyle: "flat",
        zIndex,
        cursor: interactive ? "grab" : "default",
        touchAction: interactive ? "none" : undefined,
        pointerEvents: interactive ? "auto" : "none",
        outline:
          !forExport && selected
            ? `${Math.max(2, width * 0.003)}px solid #e8ff47`
            : undefined,
        outlineOffset: Math.max(4, width * 0.004),
      }}
      onPointerDown={
        interactive ? (event) => onPointerDown?.(lens.id, event) : undefined
      }
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: lensW / 2 - contentCx * zoom,
            top: lensH / 2 - contentCy * zoom,
            width,
            height,
            transform: `scale(${zoom})`,
            transformOrigin: "0 0",
            pointerEvents: "none",
          }}
        >
          {showLockedSnapshot && lockedImageUrl ? (
            <img
              src={lockedImageUrl}
              alt=""
              draggable={false}
              crossOrigin={
                lockedImageUrl.startsWith("http") ? "anonymous" : undefined
              }
              style={{
                display: "block",
                width,
                height,
                pointerEvents: "none",
              }}
            />
          ) : (
            <Artboard
              slide={slide}
              slides={slides}
              width={width}
              height={height}
              assetUrls={assetUrls}
              guestFrames={contentGuests}
              guestCliparts={contentGuestCliparts}
              showLenses={false}
              forExport
            />
          )}
        </div>
        {border > 0 ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              boxShadow: `inset 0 0 0 ${border}px ${lens.borderColor}`,
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
      {!forExport && selected && interactive && onResizeStart ? (
        <ResizeHandles
          artboardWidth={width}
          canvasScale={canvasScale}
          onResizeStart={(handle, event) =>
            onResizeStart(lens.id, handle, event)
          }
        />
      ) : null}
    </div>
  )
}
