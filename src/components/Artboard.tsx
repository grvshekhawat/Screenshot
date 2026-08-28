import { useEffect, type PointerEvent } from "react"
import { layerZIndex, splitBackgroundCss, templateSplit, textShadowCss } from "../constants"
import type { GuestClipart, GuestFrame } from "../overflow"
import type {
  Frame,
  FrameScreenSlot,
  Slide,
  TextLayer,
} from "../types"
import { PlacedClipart } from "./PlacedClipart"
import { PlacedDevice } from "./PlacedDevice"
import { PlacedLens } from "./PlacedLens"
import { ResizeHandles, type ResizeHandle } from "./ResizeHandles"

type ArtboardProps = {
  slide: Slide
  /** All slides — continued guests keep the owner’s layer z-index. */
  slides?: Slide[]
  width: number
  height: number
  assetUrls: Record<string, string>
  guestFrames?: GuestFrame[]
  guestCliparts?: GuestClipart[]
  hideFrameIds?: Set<string>
  hideClipartIds?: Set<string>
  /** When false, skip lenses (used while rendering lens magnification). */
  showLenses?: boolean
  interactive?: boolean
  forExport?: boolean
  /** Canvas zoom — keeps resize handles usable */
  canvasScale?: number
  selectedFrameId?: string | null
  onFramePointerDown?: (
    frameId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onTextPointerDown?: (
    textId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onClipartPointerDown?: (
    clipartId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onLensPointerDown?: (
    lensId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onFrameResizeStart?: (
    frameId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onTextResizeStart?: (
    textId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onClipartResizeStart?: (
    clipartId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onLensResizeStart?: (
    lensId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onClipartAspectChange?: (clipartId: string, aspect: number) => void
  onFrameUploadClick?: (frameId: string, slot?: FrameScreenSlot) => void
  onReady?: () => void
}

function deviceLayerZIndex(
  slide: Slide,
  slides: Slide[] | undefined,
  originSlideId: string,
  frameId: string,
  isGuest: boolean,
): number {
  if (isGuest && slides) {
    const owner = slides.find((entry) => entry.id === originSlideId)
    if (owner) return layerZIndex(owner, frameId)
  }
  return layerZIndex(slide, frameId)
}

function clipartLayerZIndex(
  slide: Slide,
  slides: Slide[] | undefined,
  originSlideId: string,
  clipartId: string,
  isGuest: boolean,
): number {
  if (isGuest && slides) {
    const owner = slides.find((entry) => entry.id === originSlideId)
    if (owner) return layerZIndex(owner, clipartId)
  }
  return layerZIndex(slide, clipartId)
}

export function Artboard({
  slide,
  slides,
  width,
  height,
  assetUrls,
  guestFrames = [],
  guestCliparts = [],
  hideFrameIds,
  hideClipartIds,
  showLenses = true,
  interactive = false,
  forExport = false,
  canvasScale = 1,
  selectedFrameId = null,
  onFramePointerDown,
  onTextPointerDown,
  onClipartPointerDown,
  onLensPointerDown,
  onFrameResizeStart,
  onTextResizeStart,
  onClipartResizeStart,
  onLensResizeStart,
  onClipartAspectChange,
  onFrameUploadClick,
  onReady,
}: ArtboardProps) {
  const fontScale = width / 1320
  const placed: GuestFrame[] = [
    ...slide.frames
      .filter((frame) => !hideFrameIds?.has(frame.id))
      .map((frame) => ({
        frame,
        originSlideId: slide.id,
        isGuest: false as const,
      })),
    ...guestFrames.filter((guest) => !hideFrameIds?.has(guest.frame.id)),
  ]
  const bg = slide.background
  const bgImageUrl = bg.imageId ? (assetUrls[bg.imageId] ?? null) : null

  useEffect(() => {
    if (!onReady) return
    let cancelled = false

    const wait = async () => {
      const urls = [
        ...placed.flatMap((item) => [
          item.frame.screenshotId
            ? assetUrls[item.frame.screenshotId]
            : null,
          item.frame.screenMode === "split" && item.frame.screenshotIdB
            ? assetUrls[item.frame.screenshotIdB]
            : null,
        ]),
        ...slide.cliparts.map((clipart) => assetUrls[clipart.assetId] ?? null),
        bgImageUrl,
      ].filter((url): url is string => Boolean(url))
      await Promise.all(
        urls.map(async (url) => {
          try {
            const img = new Image()
            img.src = url
            await img.decode()
          } catch {
            /* asset may already be cached or invalid */
          }
        }),
      )
      try {
        await document.fonts.ready
      } catch {
        /* ignore font loading failures */
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) onReady()
        })
      })
    }

    void wait()
    return () => {
      cancelled = true
    }
  }, [onReady, assetUrls, slide, guestFrames, width, height, bgImageUrl])

  const split = templateSplit(slide.templateId)
  const colorBackground = split
    ? splitBackgroundCss(split, bg.colors)
    : bg.type === "gradient"
      ? `linear-gradient(${bg.angle}deg, ${bg.colors[0]}, ${bg.colors[1] ?? bg.colors[0]})`
      : bg.colors[0]

  return (
    <div
      data-artboard
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        background: bg.type === "image" && bgImageUrl ? bg.colors[0] : colorBackground,
        fontFamily: slide.texts[0]?.font ?? "Poppins",
        userSelect: interactive ? "none" : undefined,
      }}
    >
      {bg.type === "image" && bgImageUrl ? (
        <img
          src={bgImageUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: bg.imageFit,
            opacity: bg.imageOpacity,
            pointerEvents: "none",
          }}
        />
      ) : null}

      {slide.templateId === "dark-glow" ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "55%",
            width: "85%",
            height: "42%",
            borderRadius: "9999px",
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.55) 0%, rgba(14,16,40,0) 70%)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {placed.map(({ frame, originSlideId, isGuest }) => (
        <PlacedDevice
          key={`${originSlideId}-${frame.id}${isGuest ? "-guest" : ""}`}
          frame={frame}
          width={width}
          height={height}
          screenshotUrl={
            frame.screenshotId
              ? (assetUrls[frame.screenshotId] ?? null)
              : null
          }
          screenshotUrlB={
            frame.screenshotIdB
              ? (assetUrls[frame.screenshotIdB] ?? null)
              : null
          }
          selected={selectedFrameId === frame.id}
          zIndex={deviceLayerZIndex(
            slide,
            slides,
            originSlideId,
            frame.id,
            Boolean(isGuest),
          )}
          isGuest={Boolean(isGuest)}
          interactive={interactive}
          forExport={forExport}
          canvasScale={canvasScale}
          onPointerDown={onFramePointerDown}
          onResizeStart={onFrameResizeStart}
          onUploadClick={onFrameUploadClick}
        />
      ))}

      {([
        ...slide.cliparts
          .filter((clipart) => !hideClipartIds?.has(clipart.id))
          .filter((clipart) => {
            if (!clipart.attachedFrameId) return true
            // Attached to a local (non-hidden) frame — drawn with that phone below
            return !slide.frames.some(
              (frame) =>
                frame.id === clipart.attachedFrameId &&
                !hideFrameIds?.has(frame.id),
            )
          })
          .map((clipart) => ({
            clipart,
            frame: clipart.attachedFrameId
              ? (slide.frames.find(
                  (item) => item.id === clipart.attachedFrameId,
                ) ?? null)
              : null,
            originSlideId: slide.id,
            isGuest: false as const,
          })),
        ...guestCliparts
          .filter((guest) => !hideClipartIds?.has(guest.clipart.id))
          .filter((guest) => !guest.clipart.attachedFrameId)
          .map((guest) => ({
            clipart: guest.clipart,
            frame: null as Frame | null,
            originSlideId: guest.originSlideId,
            isGuest: true as const,
          })),
      ]).map(({ clipart, frame, originSlideId, isGuest }) => (
        <PlacedClipart
          key={`${originSlideId}-${clipart.id}${isGuest ? "-guest" : ""}`}
          clipart={clipart}
          frame={frame}
          artboardWidth={width}
          artboardHeight={height}
          imageUrl={assetUrls[clipart.assetId] ?? null}
          selected={selectedFrameId === clipart.id}
          zIndex={clipartLayerZIndex(
            slide,
            slides,
            originSlideId,
            clipart.id,
            Boolean(isGuest),
          )}
          interactive={interactive}
          forExport={forExport}
          canvasScale={canvasScale}
          onPointerDown={onClipartPointerDown}
          onResizeStart={onClipartResizeStart}
          onAspectChange={
            interactive && !isGuest && !forExport
              ? (clipartId, aspect) =>
                  onClipartAspectChange?.(clipartId, aspect)
              : undefined
          }
        />
      ))}

      {slide.frames
        .filter((frame) => !hideFrameIds?.has(frame.id))
        .flatMap((frame) =>
          slide.cliparts
            .filter(
              (clipart) =>
                clipart.attachedFrameId === frame.id &&
                !hideClipartIds?.has(clipart.id),
            )
            .map((clipart) => (
              <PlacedClipart
                key={`attached-${frame.id}-${clipart.id}`}
                clipart={clipart}
                frame={frame}
                artboardWidth={width}
                artboardHeight={height}
                imageUrl={assetUrls[clipart.assetId] ?? null}
                selected={selectedFrameId === clipart.id}
                zIndex={layerZIndex(slide, clipart.id)}
                interactive={interactive}
                forExport={forExport}
                canvasScale={canvasScale}
                onPointerDown={onClipartPointerDown}
                onResizeStart={onClipartResizeStart}
                onAspectChange={
                  interactive && !forExport
                    ? (clipartId, aspect) =>
                        onClipartAspectChange?.(clipartId, aspect)
                    : undefined
                }
              />
            )),
        )}

      {slide.texts.map((text) => (
        <PlacedText
          key={text.id}
          text={text}
          width={width}
          fontScale={fontScale}
          selected={selectedFrameId === text.id}
          zIndex={layerZIndex(slide, text.id)}
          interactive={interactive}
          forExport={forExport}
          canvasScale={canvasScale}
          onPointerDown={onTextPointerDown}
          onResizeStart={onTextResizeStart}
        />
      ))}

      {showLenses
        ? (slide.lenses ?? []).map((lens) => (
            <PlacedLens
              key={lens.id}
              lens={lens}
              slide={slide}
              slides={slides}
              width={width}
              height={height}
              assetUrls={assetUrls}
              guestFrames={guestFrames}
              guestCliparts={guestCliparts}
              selected={selectedFrameId === lens.id}
              zIndex={layerZIndex(slide, lens.id)}
              interactive={interactive}
              forExport={forExport}
              canvasScale={canvasScale}
              onPointerDown={onLensPointerDown}
              onResizeStart={onLensResizeStart}
            />
          ))
        : null}
    </div>
  )
}

function PlacedText({
  text,
  width,
  fontScale,
  selected,
  zIndex,
  interactive,
  forExport = false,
  canvasScale = 1,
  onPointerDown,
  onResizeStart,
}: {
  text: TextLayer
  width: number
  fontScale: number
  selected: boolean
  zIndex: number
  interactive: boolean
  forExport?: boolean
  canvasScale?: number
  onPointerDown?: (textId: string, event: PointerEvent<HTMLDivElement>) => void
  onResizeStart?: (
    textId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
}) {
  const fontSize = text.size * fontScale
  const strokeWidth = text.strokeWidth ?? 0
  const strokePx = strokeWidth * fontScale
  return (
    <div
      data-text-id={text.id}
      style={{
        position: "absolute",
        left: `${text.x}%`,
        top: `${text.y}%`,
        width: `${text.width}%`,
        transform: `translate(-50%, -50%) rotate(${text.rotation}deg)`,
        textAlign: text.align,
        color: text.color,
        fontFamily: text.font,
        fontSize,
        fontWeight: text.weight,
        lineHeight: 1.15,
        letterSpacing: "-0.03em",
        whiteSpace: "pre-wrap",
        paintOrder: strokeWidth > 0 ? "stroke fill" : undefined,
        WebkitTextStroke:
          strokeWidth > 0
            ? `${strokePx}px ${text.strokeColor || "#000000"}`
            : undefined,
        textShadow: textShadowCss(text, fontScale),
        cursor: interactive ? "grab" : "default",
        touchAction: interactive ? "none" : undefined,
        zIndex,
        outline:
          !forExport && selected
            ? `${Math.max(2, width * 0.003)}px solid #8b5cf6`
            : undefined,
        outlineOffset: Math.max(4, width * 0.004),
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={
        interactive ? (event) => onPointerDown?.(text.id, event) : undefined
      }
    >
      {text.content || "Text"}
      {!forExport && selected && interactive && onResizeStart ? (
        <ResizeHandles
          artboardWidth={width}
          canvasScale={canvasScale}
          onResizeStart={(handle, event) =>
            onResizeStart(text.id, handle, event)
          }
        />
      ) : null}
    </div>
  )
}
