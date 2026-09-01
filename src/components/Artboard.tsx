import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import { layerZIndex, normalizeLayerOrder, splitBackgroundCss, templateSplit, textShadowCss, cssFontFamily } from "../constants"
import { flattenedDeviceTransform } from "../device-transform"
import { layerFlipCss } from "../layer-flip"
import type {
  GuestClipart,
  GuestFrame,
  GuestLens,
  GuestText,
} from "../overflow"
import type {
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
  guestTexts?: GuestText[]
  guestLenses?: GuestLens[]
  hideFrameIds?: Set<string>
  hideClipartIds?: Set<string>
  /** When false, skip lenses (used while rendering lens magnification). */
  showLenses?: boolean
  interactive?: boolean
  forExport?: boolean
  /** Canvas zoom — keeps resize handles usable */
  canvasScale?: number
  selectedFrameId?: string | null
  /** All selected layer ids (multi-select highlights). */
  selectedIds?: string[]
  /** Text layer currently being edited inline (double-click). */
  editingTextId?: string | null
  onFramePointerDown?: (
    frameId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onTextPointerDown?: (
    textId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => void
  onTextDoubleClick?: (
    textId: string,
    event: MouseEvent<HTMLDivElement>,
  ) => void
  onTextContentChange?: (textId: string, content: string) => void
  onTextEditEnd?: () => void
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

export function Artboard({
  slide,
  slides,
  width,
  height,
  assetUrls,
  guestFrames = [],
  guestCliparts = [],
  guestTexts = [],
  guestLenses = [],
  hideFrameIds,
  hideClipartIds,
  showLenses = true,
  interactive = false,
  forExport = false,
  canvasScale = 1,
  selectedFrameId = null,
  selectedIds,
  editingTextId = null,
  onFramePointerDown,
  onTextPointerDown,
  onTextDoubleClick,
  onTextContentChange,
  onTextEditEnd,
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
  const selectedSet = new Set(
    selectedIds?.length
      ? selectedIds
      : selectedFrameId
        ? [selectedFrameId]
        : [],
  )
  const isSelected = (id: string) => selectedSet.has(id)

  const fontScale = width / 1320
  const extraIds = [
    ...guestFrames.map((guest) => guest.frame.id),
    ...guestCliparts.map((guest) => guest.clipart.id),
    ...guestTexts.map((guest) => guest.text.id),
    ...guestLenses.map((guest) => guest.lens.id),
  ]
  const order = normalizeLayerOrder(slide, extraIds)
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
        ...guestCliparts.map(
          (guest) => assetUrls[guest.clipart.assetId] ?? null,
        ),
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
  }, [
    onReady,
    assetUrls,
    slide,
    guestFrames,
    guestCliparts,
    width,
    height,
    bgImageUrl,
  ])

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
        fontFamily: cssFontFamily(slide.texts[0]?.font ?? "Poppins"),
        userSelect: interactive ? "none" : undefined,
      }}
    >
      {bg.type === "image" && bgImageUrl ? (
        <img
          src={bgImageUrl}
          alt=""
          crossOrigin={bgImageUrl.startsWith("http") ? "anonymous" : undefined}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: bg.imageFit,
            objectPosition: `${bg.imagePositionX ?? 50}% ${bg.imagePositionY ?? 50}%`,
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

      {stackLayers()}
    </div>
  )

  function stackLayers() {
    const z = (id: string) => layerZIndex(slide, id, extraIds)
    const framesById = new Map(placed.map((item) => [item.frame.id, item.frame]))
    const clipartItems = [
      ...slide.cliparts
        .filter((clipart) => !hideClipartIds?.has(clipart.id))
        .map((clipart) => ({
          clipart,
          frame: clipart.attachedFrameId
            ? (framesById.get(clipart.attachedFrameId) ??
              slide.frames.find((item) => item.id === clipart.attachedFrameId) ??
              null)
            : null,
          originSlideId: slide.id,
          isGuest: false as const,
        })),
      ...guestCliparts
        .filter((guest) => !hideClipartIds?.has(guest.clipart.id))
        .map((guest) => ({
          clipart: guest.clipart,
          frame: guest.clipart.attachedFrameId
            ? (framesById.get(guest.clipart.attachedFrameId) ?? null)
            : null,
          originSlideId: guest.originSlideId,
          isGuest: true as const,
        })),
    ]
    const textItems = [
      ...slide.texts.map((text) => ({
        text,
        originSlideId: slide.id,
      })),
      ...guestTexts.map((guest) => ({
        text: guest.text,
        originSlideId: guest.originSlideId,
      })),
    ]
    const lensItems = showLenses
      ? [
          ...(slide.lenses ?? []).map((lens) => ({
            lens,
            originSlide: slide,
            originSlideId: slide.id,
          })),
          ...guestLenses.map((guest) => ({
            lens: guest.source,
            originSlide:
              slides?.find((entry) => entry.id === guest.originSlideId) ??
              slide,
            originSlideId: guest.originSlideId,
            offsetX:
              guest.lens.x - guest.source.x,
          })),
        ]
      : []

    const nodes = new Map<string, ReactNode>()
    for (const { frame, originSlideId, isGuest } of placed) {
      nodes.set(
        frame.id,
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
          selected={isSelected(frame.id)}
          zIndex={z(frame.id)}
          isGuest={Boolean(isGuest)}
          interactive={interactive}
          forExport={forExport}
          canvasScale={canvasScale}
          onPointerDown={onFramePointerDown}
          onResizeStart={
            selectedFrameId === frame.id ? onFrameResizeStart : undefined
          }
          onUploadClick={onFrameUploadClick}
        />,
      )
    }
    for (const { clipart, frame, originSlideId, isGuest } of clipartItems) {
      nodes.set(
        clipart.id,
        <PlacedClipart
          key={`${originSlideId}-${clipart.id}${isGuest ? "-guest" : ""}`}
          clipart={clipart}
          frame={frame}
          artboardWidth={width}
          artboardHeight={height}
          imageUrl={assetUrls[clipart.assetId] ?? null}
          selected={isSelected(clipart.id)}
          zIndex={z(clipart.id)}
          interactive={interactive}
          forExport={forExport}
          canvasScale={canvasScale}
          onPointerDown={onClipartPointerDown}
          onResizeStart={
            selectedFrameId === clipart.id ? onClipartResizeStart : undefined
          }
          onAspectChange={
            interactive && !isGuest && !forExport
              ? (clipartId, aspect) =>
                  onClipartAspectChange?.(clipartId, aspect)
              : undefined
          }
        />,
      )
    }
    for (const { text, originSlideId } of textItems) {
      nodes.set(
        text.id,
        <PlacedText
          key={`${originSlideId}-${text.id}`}
          text={text}
          width={width}
          fontScale={fontScale}
          selected={isSelected(text.id)}
          editing={editingTextId === text.id}
          zIndex={z(text.id)}
          interactive={interactive}
          forExport={forExport}
          canvasScale={canvasScale}
          onPointerDown={onTextPointerDown}
          onDoubleClick={onTextDoubleClick}
          onContentChange={onTextContentChange}
          onEditEnd={onTextEditEnd}
          onResizeStart={
            selectedFrameId === text.id ? onTextResizeStart : undefined
          }
        />,
      )
    }
    for (const item of lensItems) {
      const offsetX =
        "offsetX" in item && typeof item.offsetX === "number" ? item.offsetX : 0
      nodes.set(
        item.lens.id,
        <div
          key={`${item.originSlideId}-${item.lens.id}`}
          style={{
            position: "absolute",
            inset: 0,
            // Wrapper spans the slide for guest offset; only the lens shape
            // should capture hits so phones/clipart underneath stay draggable.
            pointerEvents: "none",
            transform: offsetX
              ? `translateX(${(offsetX / 100) * width}px)`
              : undefined,
            zIndex: z(item.lens.id),
          }}
        >
          <PlacedLens
            lens={item.lens}
            slide={item.originSlide}
            slides={slides}
            width={width}
            height={height}
            assetUrls={assetUrls}
            guestFrames={guestFrames}
            guestCliparts={guestCliparts}
            selected={isSelected(item.lens.id)}
            zIndex={z(item.lens.id)}
            interactive={interactive}
            forExport={forExport}
            canvasScale={canvasScale}
            onPointerDown={onLensPointerDown}
            onResizeStart={
              selectedFrameId === item.lens.id ? onLensResizeStart : undefined
            }
          />
        </div>,
      )
    }

    const seen = new Set<string>()
    const stacked: ReactNode[] = []
    for (const id of order) {
      const node = nodes.get(id)
      if (!node) continue
      stacked.push(node)
      seen.add(id)
    }
    for (const [id, node] of nodes) {
      if (seen.has(id)) continue
      stacked.push(node)
    }
    return stacked
  }
}

function PlacedText({
  text,
  width,
  fontScale,
  selected,
  editing,
  zIndex,
  interactive,
  forExport = false,
  canvasScale = 1,
  onPointerDown,
  onDoubleClick,
  onContentChange,
  onEditEnd,
  onResizeStart,
}: {
  text: TextLayer
  width: number
  fontScale: number
  selected: boolean
  editing: boolean
  zIndex: number
  interactive: boolean
  forExport?: boolean
  canvasScale?: number
  onPointerDown?: (textId: string, event: PointerEvent<HTMLDivElement>) => void
  onDoubleClick?: (textId: string, event: MouseEvent<HTMLDivElement>) => void
  onContentChange?: (textId: string, content: string) => void
  onEditEnd?: () => void
  onResizeStart?: (
    textId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => void
}) {
  const fontSize = text.size * fontScale
  const strokeWidth = text.strokeWidth ?? 0
  const strokePx = strokeWidth * fontScale
  const [draft, setDraft] = useState(text.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const skipCommitRef = useRef(false)

  useEffect(() => {
    if (!editing) return
    skipCommitRef.current = false
    setDraft(text.content)
    const id = window.requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.select()
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    })
    return () => window.cancelAnimationFrame(id)
  }, [editing, text.id])

  return (
    <div
      data-text-id={text.id}
      data-text-editing={editing ? "true" : undefined}
      style={{
        position: "absolute",
        left: `${text.x}%`,
        top: `${text.y}%`,
        width: `${text.width}%`,
        // Skip flip while editing so caret / typed glyphs stay readable.
        transform: editing
          ? `translate(-50%, -50%) rotate(${text.rotation}deg)`
          : `translate(-50%, -50%) ${flattenedDeviceTransform(
              text.rotationX ?? 0,
              text.rotationY ?? 0,
              text.rotation,
              width,
            )}${layerFlipCss(text.flipH, text.flipV)}`,
        textAlign: text.align,
        color: text.color,
        fontFamily: cssFontFamily(text.font),
        fontSize,
        fontWeight: text.weight,
        lineHeight: 1.15,
        letterSpacing: "-0.03em",
        whiteSpace: "pre-wrap",
        paintOrder: !editing && strokeWidth > 0 ? "stroke fill" : undefined,
        WebkitTextStroke:
          !editing && strokeWidth > 0
            ? `${strokePx}px ${text.strokeColor || "#000000"}`
            : undefined,
        textShadow: editing ? undefined : textShadowCss(text, fontScale),
        cursor: editing ? "text" : interactive ? "grab" : "default",
        touchAction: interactive && !editing ? "none" : undefined,
        zIndex,
        isolation: "isolate",
        outline:
          !forExport && (selected || editing)
            ? `${Math.max(2, width * 0.003)}px solid #e8ff47`
            : undefined,
        outlineOffset: Math.max(4, width * 0.004),
        pointerEvents: interactive ? "auto" : "none",
        userSelect: editing ? "text" : undefined,
      }}
      onPointerDown={
        interactive
          ? (event) => {
              if (editing) {
                event.stopPropagation()
                return
              }
              onPointerDown?.(text.id, event)
            }
          : undefined
      }
      onDoubleClick={
        interactive && !forExport
          ? (event) => {
              event.preventDefault()
              event.stopPropagation()
              onDoubleClick?.(text.id, event)
            }
          : undefined
      }
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          rows={1}
          aria-label="Edit text"
          onChange={(event) => {
            setDraft(event.target.value)
            const el = event.target
            el.style.height = "auto"
            el.style.height = `${el.scrollHeight}px`
          }}
          onBlur={() => {
            if (skipCommitRef.current) {
              skipCommitRef.current = false
              return
            }
            if (!editing) return
            const value = textareaRef.current?.value ?? draft
            onContentChange?.(text.id, value)
            onEditEnd?.()
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === "Escape") {
              event.preventDefault()
              skipCommitRef.current = true
              onEditEnd?.()
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            display: "block",
            width: "100%",
            margin: 0,
            padding: 0,
            border: "none",
            outline: "none",
            resize: "none",
            overflow: "hidden",
            background: "transparent",
            color: "inherit",
            font: "inherit",
            fontSize: "inherit",
            fontWeight: "inherit",
            fontFamily: "inherit",
            lineHeight: "inherit",
            letterSpacing: "inherit",
            textAlign: "inherit",
            whiteSpace: "pre-wrap",
            caretColor: text.color || "#ffffff",
          }}
        />
      ) : (
        text.content || "Text"
      )}
      {!forExport && selected && interactive && !editing && onResizeStart ? (
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
