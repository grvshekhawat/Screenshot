import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from "react"
import { STORE_TARGETS, deviceSpec, layerZIndex } from "../constants"
import {
  clipartOverflow,
  continuityClipartIds,
  continuityClipartItems,
  continuityFrameIds,
  continuityItems,
  findClipartOwner,
  findFrameOwner,
  frameOverflow,
} from "../overflow"
import { useProject } from "../project-store"
import type { FrameScreenSlot, Slide } from "../types"
import { Artboard } from "./Artboard"
import { ComponentMenu, menuLimits } from "./ComponentMenu"
import {
  ContinuityClipartSpan,
  ContinuitySpan,
  SLIDE_GAP_PX,
} from "./ContinuitySpan"
import { screenshotDropTargetFromEvent } from "./ScreenshotDropZone"
import {
  resizeFactorFromCenter,
  type ResizeHandle,
} from "./ResizeHandles"

type DesignCanvasProps = {
  onUploadClick: (
    frameId?: string,
    slideId?: string,
    slot?: FrameScreenSlot,
  ) => void
  onFiles: (
    files: FileList | File[],
    slideId?: string,
    frameId?: string,
    slot?: FrameScreenSlot,
  ) => void
}

export function DesignCanvas({ onUploadClick, onFiles }: DesignCanvasProps) {
  const {
    project,
    viewProject,
    activeSlide,
    activeFrame,
    activeText,
    activeClipart,
    activeLens,
    selectedKind,
    assetUrls,
    selectSlide,
    selectFrame,
    selectText,
    selectClipart,
    selectLens,
    clearSelection,
    updateFrame,
    updateText,
    updateClipart,
    updateLens,
    addSlide,
    insertSlideAt,
    duplicateSlide,
    deleteSlide,
    duplicateFrame,
    duplicateText,
    duplicateClipart,
    duplicateLens,
    copyComponentToSlide,
    removeFrame,
    removeText,
    removeClipart,
    removeLens,
    moveFrame,
    moveText,
    moveClipart,
    moveLens,
    reorderSlides,
    setFrameOverflow,
    setClipartOverflow,
    canvasFocused,
  } = useProject()
  const target = STORE_TARGETS[project.targetId]
  const viewportRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(0.2)
  /** Fit tracks the viewport; manual zoomPercent is % of 1:1 artboard pixels. */
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit")
  const [zoomPercent, setZoomPercent] = useState(100)
  const dragFrom = useRef<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const count = project.slides.length
  const scale =
    zoomMode === "fit"
      ? Math.max(0.04, fitScale)
      : Math.max(0.04, Math.min(4, zoomPercent / 100))
  const displayZoomPercent = Math.round(scale * 100)
  const minZoomPercent = 5
  const maxZoomPercent = 400
  const hasComponentSelection = Boolean(
    activeText ||
      activeClipart ||
      activeLens ||
      (activeFrame && activeSlide.selectedId === activeFrame.id),
  )
  const selectedLimits = menuLimits(
    activeSlide,
    selectedKind,
    activeSlide.selectedId,
  )
  const viewActiveFrame =
    viewProject.slides
      .find((slide) => slide.id === activeSlide.id)
      ?.frames.find((frame) => frame.id === activeFrame?.id) ?? activeFrame
  const viewActiveClipart =
    viewProject.slides
      .find((slide) => slide.id === activeSlide.id)
      ?.cliparts.find((clipart) => clipart.id === activeClipart?.id) ??
    activeClipart
  const activeEdges =
    selectedKind === "clipart" && viewActiveClipart
      ? clipartOverflow(viewActiveClipart, target.width, target.height)
      : viewActiveFrame
        ? frameOverflow(viewActiveFrame, target.width, target.height)
        : { left: false, right: false, top: false, bottom: false }
  const previewSlideWidth = target.width * scale
  const previewSlideHeight = target.height * scale
  const spanningCliparts = continuityClipartItems(
    viewProject.slides,
    target.width,
    target.height,
  )
  const spanningFrames = continuityItems(
    viewProject.slides,
    target.width,
    target.height,
  )
  const hiddenFrameIds = continuityFrameIds(spanningFrames)
  const attachedToSpanningIds = new Set(
    spanningFrames.flatMap((item) => {
      const owner = viewProject.slides.find(
        (entry) => entry.id === item.ownerSlideId,
      )
      return (owner?.cliparts ?? [])
        .filter((clipart) => clipart.attachedFrameId === item.frame.id)
        .map((clipart) => clipart.id)
    }),
  )
  const hiddenClipartIds = new Set([
    ...continuityClipartIds(spanningCliparts),
    ...attachedToSpanningIds,
  ])

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const measure = () => {
      const gap = SLIDE_GAP_PX
      const addBtn = 72
      const padX = 48
      const padY = 88
      const count = project.slides.length
      const availW = el.clientWidth - padX - addBtn - Math.max(0, count - 1) * gap
      const availH = el.clientHeight - padY
      // Landscape artboards are very wide — fit ~1 slide so phones stay large.
      const fitCount =
        target.orientation === "landscape"
          ? 1
          : Math.max(count, 1)
      const scaleW = availW / (fitCount * target.width)
      const scaleH = availH / target.height
      const next = Math.min(scaleW, scaleH, 1)
      setFitScale(
        Number.isFinite(next) && next > 0 ? Math.max(next, 0.08) : 0.2,
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [target.width, target.height, target.orientation, count])

  // New store size → return to Fit so the board stays usable.
  useEffect(() => {
    setZoomMode("fit")
  }, [target.width, target.height])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.05 : 1 / 1.05
      const next = Math.round(scale * factor * 100)
      setZoomMode("manual")
      setZoomPercent(Math.min(maxZoomPercent, Math.max(minZoomPercent, next)))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [scale, minZoomPercent, maxZoomPercent])

  const bumpZoom = (direction: 1 | -1) => {
    const factor = direction > 0 ? 1.05 : 1 / 1.05
    const next = Math.round(scale * factor * 100)
    setZoomMode("manual")
    setZoomPercent(Math.min(maxZoomPercent, Math.max(minZoomPercent, next)))
  }

  const fitToView = () => {
    setZoomMode("fit")
    setZoomPercent(
      Math.max(minZoomPercent, Math.round(fitScale * 100)),
    )
  }

  const startFrameDrag = (
    slide: Slide,
    frameId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      (event.target as HTMLElement).closest(
        "button, [data-component-menu], [data-resize-handle]",
      )
    ) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const owner = findFrameOwner(project.slides, frameId) ?? slide
    const frame = owner.frames.find((item) => item.id === frameId)
    if (!frame) return
    selectSlide(owner.id)
    selectFrame(owner.id, frameId)
    const preview =
      event.currentTarget.closest("[data-preview-frame]") ??
      document.querySelector(
        `[data-slide-id="${owner.id}"] [data-preview-frame]`,
      )
    const startX = event.clientX
    const startY = event.clientY
    const origin = { x: frame.x, y: frame.y }

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      if (!(preview instanceof HTMLElement)) return
      const rect = preview.getBoundingClientRect()
      const x = origin.x + ((moveEvent.clientX - startX) / rect.width) * 100
      const y = origin.y + ((moveEvent.clientY - startY) / rect.height) * 100
      updateFrame(owner.id, frameId, {
        x: Math.min(130, Math.max(-30, x)),
        y: Math.min(130, Math.max(-30, y)),
      })
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const startTextDrag = (
    slide: Slide,
    textId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if ((event.target as HTMLElement).closest("[data-resize-handle]")) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const text = slide.texts.find((item) => item.id === textId)
    if (!text) return
    selectSlide(slide.id)
    selectText(slide.id, textId)
    const preview = event.currentTarget.closest("[data-preview-frame]")
    const startX = event.clientX
    const startY = event.clientY
    const origin = { x: text.x, y: text.y }

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      if (!(preview instanceof HTMLElement)) return
      const rect = preview.getBoundingClientRect()
      const x = origin.x + ((moveEvent.clientX - startX) / rect.width) * 100
      const y = origin.y + ((moveEvent.clientY - startY) / rect.height) * 100
      updateText(slide.id, textId, {
        x: Math.min(130, Math.max(-30, x)),
        y: Math.min(130, Math.max(-30, y)),
      })
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const startClipartDrag = (
    slide: Slide,
    clipartId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      (event.target as HTMLElement).closest(
        "button, [data-component-menu], [data-resize-handle]",
      )
    ) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const owner = findClipartOwner(project.slides, clipartId) ?? slide
    const clipart = owner.cliparts.find((item) => item.id === clipartId)
    if (!clipart) return
    selectSlide(owner.id)
    selectClipart(owner.id, clipartId)
    const preview =
      event.currentTarget.closest("[data-preview-frame]") ??
      document.querySelector(
        `[data-slide-id="${owner.id}"] [data-preview-frame]`,
      )
    const startX = event.clientX
    const startY = event.clientY
    const origin = { x: clipart.x, y: clipart.y }
    const attachedFrame = clipart.attachedFrameId
      ? owner.frames.find((frame) => frame.id === clipart.attachedFrameId)
      : null

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      if (!(preview instanceof HTMLElement)) return
      const rect = preview.getBoundingClientRect()
      const dxArtboard =
        ((moveEvent.clientX - startX) / rect.width) * 100
      const dyArtboard =
        ((moveEvent.clientY - startY) / rect.height) * 100
      if (attachedFrame) {
        const spec = deviceSpec(attachedFrame.deviceId)
        const dxDevice = dxArtboard / attachedFrame.scale
        const dyDevice =
          (dyArtboard * (target.height / target.width) * spec.aspect) /
          attachedFrame.scale
        updateClipart(owner.id, clipartId, {
          x: Math.min(160, Math.max(-160, origin.x + dxDevice)),
          y: Math.min(160, Math.max(-160, origin.y + dyDevice)),
        })
        return
      }
      updateClipart(owner.id, clipartId, {
        x: Math.min(130, Math.max(-30, origin.x + dxArtboard)),
        y: Math.min(130, Math.max(-30, origin.y + dyArtboard)),
      })
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const previewCenter = (
    preview: Element | null,
    xPercent: number,
    yPercent: number,
  ) => {
    if (!(preview instanceof HTMLElement)) return null
    const rect = preview.getBoundingClientRect()
    return {
      x: rect.left + (xPercent / 100) * rect.width,
      y: rect.top + (yPercent / 100) * rect.height,
    }
  }

  const startFrameResize = (
    slide: Slide,
    frameId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const owner = findFrameOwner(project.slides, frameId) ?? slide
    const frame = owner.frames.find((item) => item.id === frameId)
    if (!frame) return
    selectSlide(owner.id)
    selectFrame(owner.id, frameId)
    const preview =
      event.currentTarget.closest("[data-preview-frame]") ??
      document.querySelector(
        `[data-slide-id="${owner.id}"] [data-preview-frame]`,
      )
    const center = previewCenter(preview, frame.x, frame.y)
    if (!center) return
    const originScale = frame.scale
    const startX = event.clientX
    const startY = event.clientY
    const handleEl = event.currentTarget
    try {
      handleEl.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const factor = resizeFactorFromCenter(
        handle,
        startX,
        startY,
        moveEvent.clientX,
        moveEvent.clientY,
        center.x,
        center.y,
      )
      updateFrame(owner.id, frameId, {
        scale: Math.min(1.1, Math.max(0.4, originScale * factor)),
      })
    }

    const onUp = (upEvent: globalThis.PointerEvent) => {
      try {
        handleEl.releasePointerCapture(upEvent.pointerId)
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const startTextResize = (
    slide: Slide,
    textId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const text = slide.texts.find((item) => item.id === textId)
    if (!text) return
    selectSlide(slide.id)
    selectText(slide.id, textId)
    const preview = event.currentTarget.closest("[data-preview-frame]")
      ?? document.querySelector(
        `[data-slide-id="${slide.id}"] [data-preview-frame]`,
      )
    const center = previewCenter(preview, text.x, text.y)
    if (!center) return
    const originSize = text.size
    const originWidth = text.width
    const startX = event.clientX
    const startY = event.clientY
    const horizontal = handle === "e" || handle === "w"

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const factor = resizeFactorFromCenter(
        handle,
        startX,
        startY,
        moveEvent.clientX,
        moveEvent.clientY,
        center.x,
        center.y,
      )
      if (horizontal) {
        updateText(slide.id, textId, {
          width: Math.min(90, Math.max(20, originWidth * factor)),
        })
      } else {
        updateText(slide.id, textId, {
          size: Math.min(120, Math.max(24, Math.round(originSize * factor))),
          width: Math.min(90, Math.max(20, originWidth * factor)),
        })
      }
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const startClipartResize = (
    slide: Slide,
    clipartId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const owner = findClipartOwner(project.slides, clipartId) ?? slide
    const clipart = owner.cliparts.find((item) => item.id === clipartId)
    if (!clipart) return
    selectSlide(owner.id)
    selectClipart(owner.id, clipartId)
    const preview =
      event.currentTarget.closest("[data-preview-frame]") ??
      document.querySelector(
        `[data-slide-id="${owner.id}"] [data-preview-frame]`,
      )
    const attachedFrame = clipart.attachedFrameId
      ? owner.frames.find((frame) => frame.id === clipart.attachedFrameId)
      : null
    const center = attachedFrame
      ? (() => {
          if (!(preview instanceof HTMLElement)) return null
          const rect = preview.getBoundingClientRect()
          const ax =
            attachedFrame.x + clipart.x * attachedFrame.scale
          const spec = deviceSpec(attachedFrame.deviceId)
          const deviceHeightPct =
            ((attachedFrame.scale * target.width) /
              spec.aspect /
              target.height) *
            100
          const ay = attachedFrame.y + (clipart.y / 100) * deviceHeightPct
          return {
            x: rect.left + (ax / 100) * rect.width,
            y: rect.top + (ay / 100) * rect.height,
          }
        })()
      : previewCenter(preview, clipart.x, clipart.y)
    if (!center) return
    const originWidth = clipart.width
    const startX = event.clientX
    const startY = event.clientY
    const maxWidth = attachedFrame ? 160 : 80

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const factor = resizeFactorFromCenter(
        handle,
        startX,
        startY,
        moveEvent.clientX,
        moveEvent.clientY,
        center.x,
        center.y,
      )
      updateClipart(owner.id, clipartId, {
        width: Math.min(maxWidth, Math.max(8, originWidth * factor)),
      })
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const startLensDrag = (
    slide: Slide,
    lensId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      (event.target as HTMLElement).closest(
        "button, [data-component-menu], [data-resize-handle]",
      )
    ) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const lens = (slide.lenses ?? []).find((item) => item.id === lensId)
    if (!lens) return
    selectSlide(slide.id)
    selectLens(slide.id, lensId)
    const preview =
      event.currentTarget.closest("[data-preview-frame]") ??
      document.querySelector(
        `[data-slide-id="${slide.id}"] [data-preview-frame]`,
      )
    const startX = event.clientX
    const startY = event.clientY
    const origin = { x: lens.x, y: lens.y }

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      if (!(preview instanceof HTMLElement)) return
      const rect = preview.getBoundingClientRect()
      const x = origin.x + ((moveEvent.clientX - startX) / rect.width) * 100
      const y = origin.y + ((moveEvent.clientY - startY) / rect.height) * 100
      updateLens(slide.id, lensId, {
        x: Math.min(110, Math.max(-10, x)),
        y: Math.min(110, Math.max(-10, y)),
      })
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const startLensResize = (
    slide: Slide,
    lensId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const lens = (slide.lenses ?? []).find((item) => item.id === lensId)
    if (!lens) return
    selectSlide(slide.id)
    selectLens(slide.id, lensId)
    const preview =
      event.currentTarget.closest("[data-preview-frame]") ??
      document.querySelector(
        `[data-slide-id="${slide.id}"] [data-preview-frame]`,
      )
    const center = previewCenter(preview, lens.x, lens.y)
    if (!center) return
    const originWidth = lens.width
    const originHeight = lens.height
    const startX = event.clientX
    const startY = event.clientY
    const horizontal = handle === "e" || handle === "w"
    const vertical = handle === "n" || handle === "s"

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const factor = resizeFactorFromCenter(
        handle,
        startX,
        startY,
        moveEvent.clientX,
        moveEvent.clientY,
        center.x,
        center.y,
      )
      if (horizontal) {
        updateLens(slide.id, lensId, {
          width: Math.min(100, Math.max(6, originWidth * factor)),
        })
        return
      }
      if (vertical) {
        updateLens(slide.id, lensId, {
          height: Math.min(100, Math.max(6, originHeight * factor)),
        })
        return
      }
      updateLens(slide.id, lensId, {
        width: Math.min(100, Math.max(6, originWidth * factor)),
        height: Math.min(100, Math.max(6, originHeight * factor)),
      })
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const handleScreenshotFileDrop = (
    event: DragEvent,
    fallbackSlideId?: string,
  ) => {
    if (!event.dataTransfer.files.length) return
    event.preventDefault()
    event.stopPropagation()
    const target = screenshotDropTargetFromEvent(event)
    const frameId = target.frameId
    const owner = frameId
      ? findFrameOwner(project.slides, frameId)
      : undefined
    onFiles(
      event.dataTransfer.files,
      target.slideId ?? owner?.id ?? fallbackSlideId ?? activeSlide.id,
      frameId,
      target.slot,
    )
  }

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-[#0c0c10]">
      <div
        ref={viewportRef}
        className="flex min-h-0 flex-1 items-center overflow-auto px-6"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault()
            event.dataTransfer.dropEffect = "copy"
          }
        }}
        onDrop={(event) => handleScreenshotFileDrop(event)}
        onPointerDown={(event) => {
          const targetEl = event.target as HTMLElement
          if (
            targetEl.closest(
              "[data-slide-id], [data-component-menu], [data-continuity-span], [data-add-slide], [data-slide-label], [data-slide-actions], [data-canvas-zoom]",
            )
          ) {
            return
          }
          clearSelection()
        }}
      >
        <div className="mx-auto py-6 pt-10">
          <div className="flex items-end gap-4">
            <div
              className="relative flex items-end"
              style={{ gap: SLIDE_GAP_PX }}
              onContextMenu={(event) => event.preventDefault()}
            >
              {/* Insert before first slide (overlay — does not shift continuity layout) */}
              <button
                type="button"
                data-add-slide
                title="Insert slide at start"
                aria-label="Insert slide at start"
                onClick={() => insertSlideAt(0)}
                className="absolute left-0 top-[calc(50%-1.25rem)] z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-violet-400/80 bg-zinc-900 text-xs font-semibold text-white shadow-md shadow-black/40 transition hover:border-violet-300 hover:bg-violet-600"
              >
                +
              </button>

              {project.slides.map((slide, index) => {
                const viewSlide =
                  viewProject.slides.find((entry) => entry.id === slide.id) ??
                  slide
                const selected = canvasFocused && slide.id === activeSlide.id
                const isDropTarget = dropIndex === index
                return (
                  <div
                    key={slide.id}
                    className={`group relative flex shrink-0 flex-col items-center gap-2 ${
                      isDropTarget ? "rounded-lg ring-2 ring-violet-500/70" : ""
                    }`}
                    onContextMenu={(event) => event.preventDefault()}
                    onDragOver={(event) => {
                      if (dragFrom.current === null) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = "move"
                      setDropIndex(index)
                    }}
                    onDragLeave={() => {
                      setDropIndex((current) =>
                        current === index ? null : current,
                      )
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (dragFrom.current === null) return
                      reorderSlides(dragFrom.current, index)
                      dragFrom.current = null
                      setDropIndex(null)
                    }}
                  >
                    <div
                      data-slide-id={slide.id}
                      className="relative"
                      style={{
                        width: target.width * scale,
                        height: target.height * scale,
                      }}
                    >
                      <div
                        data-slide-actions
                        className="absolute inset-x-0 bottom-full z-30 mb-1.5 flex items-center justify-center gap-1"
                      >
                        <button
                          type="button"
                          title="Copy slide"
                          aria-label="Copy slide"
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-300 ring-1 ring-white/10 hover:bg-zinc-800 hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation()
                            duplicateSlide(slide.id)
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            aria-hidden
                          >
                            <rect
                              x="3.5"
                              y="3.5"
                              width="7"
                              height="7"
                              rx="1"
                              stroke="currentColor"
                            />
                            <path
                              d="M8.5 3.5V2.5A1 1 0 0 0 7.5 1.5H2.5A1 1 0 0 0 1.5 2.5v5a1 1 0 0 0 1 1h1"
                              stroke="currentColor"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Delete slide"
                          aria-label="Delete slide"
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-300 ring-1 ring-white/10 hover:bg-zinc-800 hover:text-red-400"
                          onClick={(event) => {
                            event.stopPropagation()
                            deleteSlide(slide.id)
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M2.5 3.5h7M5 3.5V2.5h2v1M4 5v4M6 5v4M8 5v4M3.5 3.5l.5 7h4l.5-7"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                      <div
                        data-preview-frame
                        className={`relative overflow-clip rounded-sm shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_50px_rgba(0,0,0,0.45)] ${
                          selected
                            ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0c0c10]"
                            : "ring-1 ring-zinc-800"
                        }`}
                        style={{
                          width: target.width * scale,
                          height: target.height * scale,
                        }}
                        onContextMenu={(event) => event.preventDefault()}
                        onPointerDown={() => selectSlide(slide.id)}
                        onDragOver={(event) => {
                          if (!event.dataTransfer.types.includes("Files")) return
                          event.preventDefault()
                          event.stopPropagation()
                          event.dataTransfer.dropEffect = "copy"
                        }}
                        onDrop={(event) =>
                          handleScreenshotFileDrop(event, slide.id)
                        }
                      >
                        <div
                          data-artboard-scale-root
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: target.width,
                            height: target.height,
                            transform: `scale(${scale})`,
                            transformOrigin: "top left",
                          }}
                        >
                          <Artboard
                            slide={viewSlide}
                            slides={viewProject.slides}
                            width={target.width}
                            height={target.height}
                            assetUrls={assetUrls}
                            guestFrames={[]}
                            guestCliparts={[]}
                            hideFrameIds={hiddenFrameIds}
                            hideClipartIds={hiddenClipartIds}
                            interactive
                            canvasScale={scale}
                            selectedFrameId={slide.selectedId}
                            onFramePointerDown={(frameId, event) => {
                              const owner =
                                findFrameOwner(project.slides, frameId) ?? slide
                              startFrameDrag(owner, frameId, event)
                            }}
                            onTextPointerDown={(textId, event) =>
                              startTextDrag(slide, textId, event)
                            }
                            onClipartPointerDown={(clipartId, event) => {
                              const owner =
                                findClipartOwner(project.slides, clipartId) ??
                                slide
                              startClipartDrag(owner, clipartId, event)
                            }}
                            onFrameResizeStart={(frameId, handle, event) => {
                              const owner =
                                findFrameOwner(project.slides, frameId) ?? slide
                              startFrameResize(owner, frameId, handle, event)
                            }}
                            onTextResizeStart={(textId, handle, event) =>
                              startTextResize(slide, textId, handle, event)
                            }
                            onClipartResizeStart={(clipartId, handle, event) => {
                              const owner =
                                findClipartOwner(project.slides, clipartId) ??
                                slide
                              startClipartResize(owner, clipartId, handle, event)
                            }}
                            onLensPointerDown={(lensId, event) =>
                              startLensDrag(slide, lensId, event)
                            }
                            onLensResizeStart={(lensId, handle, event) =>
                              startLensResize(slide, lensId, handle, event)
                            }
                            onClipartAspectChange={(clipartId, aspect) => {
                              const owner =
                                findClipartOwner(project.slides, clipartId) ??
                                slide
                              updateClipart(owner.id, clipartId, { aspect })
                            }}
                            onFrameUploadClick={(frameId, slot) => {
                              const owner = findFrameOwner(
                                project.slides,
                                frameId,
                              )
                              onUploadClick(
                                frameId,
                                owner?.id ?? slide.id,
                                slot,
                              )
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      data-slide-label
                      className="relative h-7 w-full cursor-pointer text-[11px] text-zinc-500"
                      style={{ width: target.width * scale }}
                      onClick={() => selectSlide(slide.id)}
                    >
                      <div className="flex h-full items-center justify-center">
                        <span
                          draggable
                          title="Drag to rearrange"
                          onDragStart={(event) => {
                            dragFrom.current = index
                            event.dataTransfer.effectAllowed = "move"
                            event.dataTransfer.setData(
                              "text/plain",
                              String(index),
                            )
                          }}
                          onDragEnd={() => {
                            dragFrom.current = null
                            setDropIndex(null)
                          }}
                          className="cursor-grab rounded px-1 py-0.5 font-medium text-zinc-400 active:cursor-grabbing hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          ⋮⋮ {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 bg-[#0c0c10]/opacity-0 transition-opacity duration-75 group-hover:pointer-events-auto group-hover:opacity-100">
                        <button
                          type="button"
                          title="Move left"
                          disabled={index === 0}
                          className="rounded px-1 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                          onClick={(event) => {
                            event.stopPropagation()
                            reorderSlides(index, index - 1)
                          }}
                        >
                          ←
                        </button>
                        <span
                          draggable
                          title="Drag to rearrange"
                          onDragStart={(event) => {
                            dragFrom.current = index
                            event.dataTransfer.effectAllowed = "move"
                            event.dataTransfer.setData(
                              "text/plain",
                              String(index),
                            )
                          }}
                          onDragEnd={() => {
                            dragFrom.current = null
                            setDropIndex(null)
                          }}
                          className="cursor-grab rounded px-1 py-0.5 font-medium text-zinc-400 active:cursor-grabbing hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          ⋮⋮ {String(index + 1).padStart(2, "0")}
                        </span>
                        <button
                          type="button"
                          title="Move right"
                          disabled={index >= project.slides.length - 1}
                          className="rounded px-1 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                          onClick={(event) => {
                            event.stopPropagation()
                            reorderSlides(index, index + 1)
                          }}
                        >
                          →
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Insert to the left of each slide (except the first — use the start +) */}
              {project.slides.map((_, index) => {
                if (index === 0) return null
                const left =
                  index * previewSlideWidth + index * SLIDE_GAP_PX
                return (
                  <button
                    key={`insert-${index}`}
                    type="button"
                    data-add-slide
                    title={`Insert slide to the left of ${String(index + 1).padStart(2, "0")}`}
                    aria-label={`Insert slide to the left of ${index + 1}`}
                    onClick={() => insertSlideAt(index)}
                    className="absolute z-20 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-violet-400/80 bg-zinc-900 text-xs font-semibold text-white shadow-md shadow-black/40 transition hover:border-violet-300 hover:bg-violet-600"
                    style={{
                      left,
                      top: previewSlideHeight / 2,
                      marginTop: -10,
                    }}
                  >
                    +
                  </button>
                )
              })}

              {spanningFrames.map((item) => {
                const ownerSlide =
                  viewProject.slides.find(
                    (entry) => entry.id === item.ownerSlideId,
                  ) ??
                  viewProject.slides.find(
                    (entry) => entry.id === activeSlide.id,
                  ) ??
                  viewProject.slides[0]
                const designOwner =
                  project.slides.find(
                    (entry) => entry.id === item.ownerSlideId,
                  ) ?? activeSlide
                const attachedCliparts = ownerSlide.cliparts
                  .filter(
                    (clipart) => clipart.attachedFrameId === item.frame.id,
                  )
                  .map((clipart) => ({
                    clipart,
                    imageUrl: assetUrls[clipart.assetId] ?? null,
                    selected:
                      canvasFocused && designOwner.selectedId === clipart.id,
                    zIndex: layerZIndex(designOwner, clipart.id),
                  }))
                return (
                  <ContinuitySpan
                    key={item.frame.id}
                    frame={item.frame}
                    attachedCliparts={attachedCliparts}
                    ownerSlideIndex={item.ownerSlideIndex}
                    clipIndices={item.clipIndices}
                    artboardWidth={target.width}
                    artboardHeight={target.height}
                    previewSlideWidth={previewSlideWidth}
                    previewSlideHeight={previewSlideHeight}
                    scale={scale}
                    screenshotUrl={
                      item.frame.screenshotId
                        ? (assetUrls[item.frame.screenshotId] ?? null)
                        : null
                    }
                    screenshotUrlB={
                      item.frame.screenshotIdB
                        ? (assetUrls[item.frame.screenshotIdB] ?? null)
                        : null
                    }
                    selected={
                      canvasFocused &&
                      designOwner.selectedId === item.frame.id
                    }
                    zIndex={layerZIndex(designOwner, item.frame.id)}
                    interactive
                    onPointerDown={(frameId, event) =>
                      startFrameDrag(designOwner, frameId, event)
                    }
                    onResizeStart={(frameId, handle, event) =>
                      startFrameResize(designOwner, frameId, handle, event)
                    }
                    onUploadClick={(frameId, slot) =>
                      onUploadClick(frameId, designOwner.id, slot)
                    }
                    onClipartPointerDown={(clipartId, event) =>
                      startClipartDrag(designOwner, clipartId, event)
                    }
                    onClipartResizeStart={(clipartId, handle, event) =>
                      startClipartResize(designOwner, clipartId, handle, event)
                    }
                  />
                )
              })}

              {spanningCliparts.map((item) => {
                const designOwner =
                  project.slides.find(
                    (entry) => entry.id === item.ownerSlideId,
                  ) ?? activeSlide
                return (
                  <ContinuityClipartSpan
                    key={item.clipart.id}
                    clipart={item.clipart}
                    ownerSlideIndex={item.ownerSlideIndex}
                    clipIndices={item.clipIndices}
                    artboardWidth={target.width}
                    artboardHeight={target.height}
                    previewSlideWidth={previewSlideWidth}
                    previewSlideHeight={previewSlideHeight}
                    scale={scale}
                    imageUrl={
                      assetUrls[item.clipart.assetId] ?? null
                    }
                    selected={
                      canvasFocused &&
                      designOwner.selectedId === item.clipart.id
                    }
                    zIndex={layerZIndex(designOwner, item.clipart.id)}
                    interactive
                    onPointerDown={(clipartId, event) =>
                      startClipartDrag(designOwner, clipartId, event)
                    }
                    onResizeStart={(clipartId, handle, event) =>
                      startClipartResize(designOwner, clipartId, handle, event)
                    }
                  />
                )
              })}

              {canvasFocused && hasComponentSelection ? (
                <ComponentMenu
                  kind={selectedKind}
                  frame={selectedKind === "frame" ? activeFrame : null}
                  text={selectedKind === "text" ? activeText : null}
                  clipart={
                    selectedKind === "clipart" ? activeClipart : null
                  }
                  lens={selectedKind === "lens" ? activeLens : null}
                  previewWidth={target.width * scale}
                  previewHeight={target.height * scale}
                  offsetLeft={
                    Math.max(
                      0,
                      project.slides.findIndex((s) => s.id === activeSlide.id),
                    ) *
                    (previewSlideWidth + SLIDE_GAP_PX)
                  }
                  canDuplicate={selectedLimits.canDuplicate}
                  canDelete={selectedLimits.canDelete}
                  canMoveUp={selectedLimits.canMoveUp}
                  canMoveDown={selectedLimits.canMoveDown}
                  slides={project.slides}
                  currentSlideId={activeSlide.id}
                  onDuplicate={() => {
                    if (selectedKind === "text" && activeText) {
                      duplicateText(activeSlide.id, activeText.id)
                      return
                    }
                    if (selectedKind === "clipart" && activeClipart) {
                      duplicateClipart(activeSlide.id, activeClipart.id)
                      return
                    }
                    if (selectedKind === "lens" && activeLens) {
                      duplicateLens(activeSlide.id, activeLens.id)
                      return
                    }
                    if (activeFrame)
                      duplicateFrame(activeSlide.id, activeFrame.id)
                  }}
                  onCopyToSlide={(targetSlideId) => {
                    const componentId =
                      selectedKind === "text"
                        ? activeText?.id
                        : selectedKind === "clipart"
                          ? activeClipart?.id
                          : selectedKind === "lens"
                            ? activeLens?.id
                            : activeFrame?.id
                    if (componentId) {
                      copyComponentToSlide(
                        activeSlide.id,
                        componentId,
                        targetSlideId,
                      )
                    }
                  }}
                  onDelete={() => {
                    if (selectedKind === "text" && activeText) {
                      removeText(activeSlide.id, activeText.id)
                      return
                    }
                    if (selectedKind === "clipart" && activeClipart) {
                      removeClipart(activeSlide.id, activeClipart.id)
                      return
                    }
                    if (selectedKind === "lens" && activeLens) {
                      removeLens(activeSlide.id, activeLens.id)
                      return
                    }
                    if (activeFrame)
                      removeFrame(activeSlide.id, activeFrame.id)
                  }}
                  onMoveUp={() => {
                    if (selectedKind === "text" && activeText) {
                      moveText(activeSlide.id, activeText.id, "forward")
                      return
                    }
                    if (selectedKind === "clipart" && activeClipart) {
                      moveClipart(activeSlide.id, activeClipart.id, "forward")
                      return
                    }
                    if (selectedKind === "lens" && activeLens) {
                      moveLens(activeSlide.id, activeLens.id, "forward")
                      return
                    }
                    if (activeFrame)
                      moveFrame(activeSlide.id, activeFrame.id, "forward")
                  }}
                  onMoveDown={() => {
                    if (selectedKind === "text" && activeText) {
                      moveText(activeSlide.id, activeText.id, "back")
                      return
                    }
                    if (selectedKind === "clipart" && activeClipart) {
                      moveClipart(activeSlide.id, activeClipart.id, "back")
                      return
                    }
                    if (selectedKind === "lens" && activeLens) {
                      moveLens(activeSlide.id, activeLens.id, "back")
                      return
                    }
                    if (activeFrame)
                      moveFrame(activeSlide.id, activeFrame.id, "back")
                  }}
                  onCut={
                    selectedKind === "clipart" && activeClipart
                      ? () =>
                          setClipartOverflow(
                            activeSlide.id,
                            activeClipart.id,
                            "cut",
                            activeEdges,
                          )
                      : activeFrame && selectedKind === "frame"
                        ? () =>
                            setFrameOverflow(
                              activeSlide.id,
                              activeFrame.id,
                              "cut",
                              activeEdges,
                            )
                        : undefined
                  }
                  onContinue={
                    selectedKind === "clipart" && activeClipart
                      ? () =>
                          setClipartOverflow(
                            activeSlide.id,
                            activeClipart.id,
                            "continue",
                            activeEdges,
                          )
                      : activeFrame && selectedKind === "frame"
                        ? () =>
                            setFrameOverflow(
                              activeSlide.id,
                              activeFrame.id,
                              "continue",
                              activeEdges,
                            )
                        : undefined
                  }
                />
              ) : null}
            </div>

            <button
              type="button"
              data-add-slide
              onClick={addSlide}
              className="mb-8 flex w-16 shrink-0 flex-col items-center justify-center gap-1 self-center rounded-xl border border-dashed border-zinc-700 py-10 text-zinc-500 hover:border-violet-500 hover:text-white"
              style={{ height: Math.max(96, target.height * scale * 0.4) }}
              aria-label="Add slide at end"
            >
              <span className="text-2xl leading-none">+</span>
              <span className="text-[10px]">Slide</span>
            </button>
          </div>
        </div>
      </div>
      <div
        data-canvas-zoom
        className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-1"
      >
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg bg-zinc-950/95 p-0.5 shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out"
            disabled={displayZoomPercent <= minZoomPercent}
            onClick={() => bumpZoom(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
          >
            −
          </button>
          <button
            type="button"
            title={
              zoomMode === "fit"
                ? "Fit to view (click for 100%)"
                : "Zoom level — click to fit"
            }
            aria-label={`Zoom ${displayZoomPercent} percent`}
            onClick={() => {
              if (zoomMode === "fit") {
                setZoomMode("manual")
                setZoomPercent(100)
              } else {
                fitToView()
              }
            }}
            className="min-w-[3.25rem] rounded-md px-1.5 py-1 text-center font-mono text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            {displayZoomPercent}%
          </button>
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in"
            disabled={displayZoomPercent >= maxZoomPercent}
            onClick={() => bumpZoom(1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
          >
            +
          </button>
          <span className="mx-0.5 h-4 w-px bg-white/10" />
          <button
            type="button"
            title="Fit slides to view"
            onClick={fitToView}
            className={`rounded-md px-2 py-1 text-[11px] hover:bg-zinc-800 hover:text-white ${
              zoomMode === "fit"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400"
            }`}
          >
            Fit
          </button>
        </div>
      </div>
      <p className="pb-3 text-center text-xs text-zinc-500">
        {target.width} × {target.height} · {target.name} · drag ⋮⋮ to rearrange
        · + between slides to insert · ⌘/Ctrl+scroll to zoom
      </p>
    </section>
  )
}

