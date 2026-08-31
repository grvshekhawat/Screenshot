import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from "react"
import { createPortal } from "react-dom"
import { STORE_TARGETS, deviceSpec, CLIPART_WIDTH_MIN, CLIPART_WIDTH_MAX } from "../constants"
import { isTypingTarget } from "../platform"
import {
  clipartOverflow,
  findClipartOwner,
  findFrameOwner,
  findLensOwner,
  findTextOwner,
  frameOverflow,
  guestClipartsForSlide,
  guestFramesForSlide,
  guestIdsForSlide,
  guestLensesForSlide,
  guestTextsForSlide,
} from "../overflow"
import { useProject } from "../project-store"
import {
  getSelectedIds,
  selectionMoveOrigins,
  selectionSizeOrigins,
} from "../selection"
import type { FrameScreenSlot, SelectedKind, Slide } from "../types"
import { Artboard } from "./Artboard"
import { ComponentMenu, menuLimits } from "./ComponentMenu"
import { SLIDE_GAP_PX } from "./ContinuitySpan"
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
  /** Mount point in the editor top bar for select/hand + zoom controls. */
  chromeHost?: HTMLElement | null
}

export function DesignCanvas({
  onUploadClick,
  onFiles,
  chromeHost = null,
}: DesignCanvasProps) {
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
    setSelectionPrimary,
    clearSelection,
    deselectComponents,
    updateFrame,
    updateText,
    updateClipart,
    updateLens,
    moveSelectionByArtboardDelta,
    applySelectionSizeFactor,
    selectedIds,
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
    setTextOverflow,
    setLensOverflow,
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
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  /** Pointer tool: select layers, or hand to pan the viewport. */
  const [canvasTool, setCanvasTool] = useState<"select" | "hand">("select")
  const [spacePan, setSpacePan] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panningRef = useRef(false)
  const scale =
    zoomMode === "fit"
      ? Math.max(0.04, fitScale)
      : Math.max(0.04, Math.min(4, zoomPercent / 100))
  const displayZoomPercent = Math.round(scale * 100)
  const minZoomPercent = 5
  const maxZoomPercent = 400
  const effectiveTool: "select" | "hand" =
    spacePan || canvasTool === "hand" ? "hand" : "select"
  const selecting = effectiveTool === "select"
  const hasComponentSelection = selectedIds.length > 0
  const selectedLimits = menuLimits(
    activeSlide,
    selectedKind,
    activeSlide.selectedId,
    guestIdsForSlide(
      project.slides,
      Math.max(
        0,
        project.slides.findIndex((entry) => entry.id === activeSlide.id),
      ),
      target.width,
      target.height,
    ),
  )

  const isAdditivePointer = (event: {
    shiftKey: boolean
    metaKey: boolean
    ctrlKey: boolean
  }) => event.shiftKey || event.metaKey || event.ctrlKey

  const selectLayer = (
    slide: Slide,
    kind: SelectedKind,
    id: string,
    additive: boolean,
  ) => {
    selectSlide(slide.id)
    if (kind === "frame") selectFrame(slide.id, id, additive)
    else if (kind === "text") selectText(slide.id, id, additive)
    else if (kind === "clipart") selectClipart(slide.id, id, additive)
    else selectLens(slide.id, id, additive)
  }

  /** Resolve which ids to drag after a pointer-down on a layer. */
  const prepareSelectionDrag = (
    slide: Slide,
    kind: SelectedKind,
    id: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    const additive = isAdditivePointer(event)
    const current = getSelectedIds(
      project.slides.find((entry) => entry.id === slide.id) ?? slide,
    )
    if (additive) {
      selectLayer(slide, kind, id, true)
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
      if (!next.includes(id)) return null
      return next
    }
    if (current.includes(id) && current.length > 1) {
      setSelectionPrimary(slide.id, id)
      return current
    }
    selectLayer(slide, kind, id, false)
    return [id]
  }

  const startSelectionDrag = (
    slide: Slide,
    kind: SelectedKind,
    id: string,
    event: PointerEvent<HTMLDivElement>,
    options?: { dragThreshold?: number },
  ) => {
    if (!selecting) return
    if (
      (event.target as HTMLElement).closest(
        "button, [data-component-menu], [data-resize-handle]",
      )
    ) {
      return
    }
    if (kind === "text" && editingTextId === id) return
    event.preventDefault()
    event.stopPropagation()
    const moveIds = prepareSelectionDrag(slide, kind, id, event)
    if (!moveIds?.length) return
    const preview =
      event.currentTarget.closest("[data-preview-frame]") ??
      document.querySelector(
        `[data-slide-id="${slide.id}"] [data-preview-frame]`,
      )
    const startX = event.clientX
    const startY = event.clientY
    const origins = selectionMoveOrigins(project, moveIds)
    const threshold = options?.dragThreshold ?? 0
    let dragging = threshold <= 0

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      if (!(preview instanceof HTMLElement)) return
      if (!dragging) {
        const dist = Math.hypot(
          moveEvent.clientX - startX,
          moveEvent.clientY - startY,
        )
        if (dist < threshold) return
        dragging = true
      }
      const rect = preview.getBoundingClientRect()
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100
      moveSelectionByArtboardDelta(origins, dx, dy)
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

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
  const stridePercent =
    100 + (SLIDE_GAP_PX / Math.max(1, previewSlideWidth)) * 100

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const measure = () => {
      // Fit = page height fills the canvas area, never larger than 100%.
      const labelH = 28 // h-7 under each slide
      const gapY = 8 // gap-2 between page and label
      const actionsH = 30 // copy/delete row above the page
      const availH = el.clientHeight - labelH - gapY - actionsH
      const scaleH = availH / target.height
      const next = Math.min(scaleH, 1)
      setFitScale(
        Number.isFinite(next) && next > 0 ? Math.max(next, 0.08) : 0.2,
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [target.height])

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
      const base = Math.max(minZoomPercent, Math.round(scale * 100))
      const step = Math.max(5, Math.round(base * 0.05))
      const next = base + (event.deltaY < 0 ? step : -step)
      setZoomMode("manual")
      setZoomPercent(Math.min(maxZoomPercent, Math.max(minZoomPercent, next)))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [scale, minZoomPercent, maxZoomPercent])

  const bumpZoom = (direction: 1 | -1) => {
    const base = Math.max(minZoomPercent, displayZoomPercent)
    // At least 5 percentage points so Fit → Manual always feels responsive.
    const step = Math.max(5, Math.round(base * 0.05))
    const next = base + direction * step
    setZoomMode("manual")
    setZoomPercent(Math.min(maxZoomPercent, Math.max(minZoomPercent, next)))
  }

  const fitToView = () => {
    setZoomMode("fit")
    setZoomPercent(Math.max(minZoomPercent, Math.round(fitScale * 100)))
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault()
        setSpacePan(true)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === "v") {
        event.preventDefault()
        setCanvasTool("select")
      } else if (key === "h") {
        event.preventDefault()
        setCanvasTool("hand")
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePan(false)
    }
    const onBlur = () => setSpacePan(false)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  const startPan = (event: PointerEvent<HTMLElement>) => {
    const el = viewportRef.current
    if (!el || panningRef.current) return
    if (
      (event.target as HTMLElement).closest(
        "button, a, input, textarea, select, [data-canvas-zoom], [data-canvas-tools], [data-component-menu], [data-slide-actions], [data-text-editing]",
      )
    ) {
      return
    }
    event.preventDefault()
    panningRef.current = true
    setIsPanning(true)
    const startX = event.clientX
    const startY = event.clientY
    const originLeft = el.scrollLeft
    const originTop = el.scrollTop

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      el.scrollLeft = originLeft - (moveEvent.clientX - startX)
      el.scrollTop = originTop - (moveEvent.clientY - startY)
    }
    const onUp = () => {
      panningRef.current = false
      setIsPanning(false)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const startFrameDrag = (
    slide: Slide,
    frameId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    startSelectionDrag(slide, "frame", frameId, event)
  }

  useEffect(() => {
    if (!editingTextId) return
    if (activeSlide.selectedId !== editingTextId) {
      setEditingTextId(null)
    }
  }, [activeSlide.selectedId, editingTextId])

  const startTextDrag = (
    slide: Slide,
    textId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    startSelectionDrag(slide, "text", textId, event, { dragThreshold: 4 })
  }

  const beginTextEdit = (slide: Slide, textId: string) => {
    const owner = findTextOwner(project.slides, textId) ?? slide
    if (!owner.texts.some((item) => item.id === textId)) return
    selectSlide(slide.id)
    selectText(slide.id, textId)
    setEditingTextId(textId)
  }

  const commitTextContent = (textId: string, content: string) => {
    const owner = findTextOwner(project.slides, textId)
    if (!owner) return
    updateText(owner.id, textId, { content })
  }

  const startClipartDrag = (
    slide: Slide,
    clipartId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    startSelectionDrag(slide, "clipart", clipartId, event)
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
    if (!selecting) return
    event.preventDefault()
    event.stopPropagation()
    const owner = findFrameOwner(project.slides, frameId) ?? slide
    const frame = owner.frames.find((item) => item.id === frameId)
    if (!frame) return
    const currentIds = getSelectedIds(
      project.slides.find((entry) => entry.id === slide.id) ?? slide,
    )
    const resizeIds =
      currentIds.includes(frameId) && currentIds.length > 1
        ? currentIds
        : [frameId]
    selectSlide(slide.id)
    if (resizeIds.length > 1) setSelectionPrimary(slide.id, frameId)
    else selectFrame(slide.id, frameId)
    const preview =
      event.currentTarget.closest("[data-preview-frame]") ??
      document.querySelector(
        `[data-slide-id="${owner.id}"] [data-preview-frame]`,
      )
    const center = previewCenter(preview, frame.x, frame.y)
    if (!center) return
    const originScale = frame.scale
    const sizeOrigins = selectionSizeOrigins(project, resizeIds)
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
      if (resizeIds.length > 1) {
        applySelectionSizeFactor(sizeOrigins, factor)
        return
      }
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
    if (!selecting) return
    event.preventDefault()
    event.stopPropagation()
    const owner = findTextOwner(project.slides, textId) ?? slide
    const text = owner.texts.find((item) => item.id === textId)
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
        updateText(owner.id, textId, {
          width: Math.min(90, Math.max(20, originWidth * factor)),
        })
      } else {
        updateText(owner.id, textId, {
          size: Math.max(1, Math.round(originSize * factor)),
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
    if (!selecting) return
    event.preventDefault()
    event.stopPropagation()
    const owner = findClipartOwner(project.slides, clipartId) ?? slide
    const clipart = owner.cliparts.find((item) => item.id === clipartId)
    if (!clipart) return
    selectSlide(slide.id)
    selectClipart(slide.id, clipartId)
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
        width: Math.min(
          CLIPART_WIDTH_MAX,
          Math.max(CLIPART_WIDTH_MIN, originWidth * factor),
        ),
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
    startSelectionDrag(slide, "lens", lensId, event)
  }

  const startLensResize = (
    slide: Slide,
    lensId: string,
    handle: ResizeHandle,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!selecting) return
    event.preventDefault()
    event.stopPropagation()
    const owner = findLensOwner(project.slides, lensId) ?? slide
    const lens = (owner.lenses ?? []).find((item) => item.id === lensId)
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
        updateLens(owner.id, lensId, {
          width: Math.min(100, Math.max(6, originWidth * factor)),
        })
        return
      }
      if (vertical) {
        updateLens(owner.id, lensId, {
          height: Math.min(100, Math.max(6, originHeight * factor)),
        })
        return
      }
      updateLens(owner.id, lensId, {
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
    <section className="relative flex h-full min-h-0 min-w-0 flex-col bg-[#07070a]">
      <div
        ref={viewportRef}
        className={`flex min-h-0 flex-1 overflow-auto px-6 ${
          effectiveTool === "hand"
            ? isPanning
              ? "cursor-grabbing"
              : "cursor-grab"
            : ""
        }`}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault()
            event.dataTransfer.dropEffect = "copy"
          }
        }}
        onDrop={(event) => handleScreenshotFileDrop(event)}
        onPointerDown={(event) => {
          // Middle mouse always pans.
          if (event.button === 1) {
            startPan(event)
            return
          }
          if (event.button !== 0) return
          if (effectiveTool === "hand") {
            startPan(event)
            return
          }
          const targetEl = event.target as HTMLElement
          if (
            targetEl.closest(
              "[data-slide-id], [data-component-menu], [data-continuity-span], [data-slide-label], [data-slide-actions], [data-canvas-zoom], [data-canvas-tools]",
            )
          ) {
            return
          }
          clearSelection()
        }}
      >
        {/* m-auto centers when content is smaller than the pane; unlike
            items-center on the scroller, it still allows panning to the top
            when zoomed in. */}
        <div className="m-auto w-max shrink-0 py-6 pt-10">
          <div className="flex items-end gap-4">
            <div
              className="relative flex items-end"
              style={{ gap: SLIDE_GAP_PX }}
              onContextMenu={(event) => event.preventDefault()}
            >
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
                      isDropTarget ? "rounded-lg ring-2 ring-[#e8ff47]/70" : ""
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
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-300 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white"
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
                            ? "ring-2 ring-[#e8ff47] ring-offset-2 ring-offset-[#07070a]"
                            : "ring-1 ring-zinc-800"
                        }`}
                        style={{
                          width: target.width * scale,
                          height: target.height * scale,
                        }}
                        onContextMenu={(event) => event.preventDefault()}
                        onPointerDown={(event) => {
                          if (effectiveTool === "hand" || event.button === 1) {
                            return
                          }
                          const targetEl = event.target as HTMLElement
                          // Layer handlers stopPropagation; if a layer hit
                          // somehow bubbles, don't treat it as empty slide.
                          if (
                            targetEl.closest(
                              "[data-frame-id], [data-text-id], [data-clipart-id], [data-lens-id], [data-resize-handle], [data-component-menu], [data-continuity-span], [data-text-editing]",
                            )
                          ) {
                            return
                          }
                          selectSlide(slide.id)
                          deselectComponents()
                        }}
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
                            guestFrames={guestFramesForSlide(
                              viewProject.slides,
                              index,
                              target.width,
                              target.height,
                              stridePercent,
                            )}
                            guestCliparts={guestClipartsForSlide(
                              viewProject.slides,
                              index,
                              target.width,
                              target.height,
                              stridePercent,
                            )}
                            guestTexts={guestTextsForSlide(
                              viewProject.slides,
                              index,
                              target.width,
                              target.height,
                              stridePercent,
                            )}
                            guestLenses={guestLensesForSlide(
                              viewProject.slides,
                              index,
                              target.width,
                              target.height,
                              stridePercent,
                            )}
                            interactive={selecting}
                            canvasScale={scale}
                            selectedFrameId={slide.selectedId}
                            selectedIds={getSelectedIds(slide)}
                            editingTextId={editingTextId}
                            onFramePointerDown={(frameId, event) =>
                              startFrameDrag(slide, frameId, event)
                            }
                            onTextPointerDown={(textId, event) =>
                              startTextDrag(slide, textId, event)
                            }
                            onTextDoubleClick={(textId) =>
                              beginTextEdit(slide, textId)
                            }
                            onTextContentChange={commitTextContent}
                            onTextEditEnd={() => setEditingTextId(null)}
                            onClipartPointerDown={(clipartId, event) =>
                              startClipartDrag(slide, clipartId, event)
                            }
                            onFrameResizeStart={(frameId, handle, event) =>
                              startFrameResize(slide, frameId, handle, event)
                            }
                            onTextResizeStart={(textId, handle, event) =>
                              startTextResize(slide, textId, handle, event)
                            }
                            onClipartResizeStart={(clipartId, handle, event) =>
                              startClipartResize(slide, clipartId, handle, event)
                            }
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
                      onClick={() => {
                        selectSlide(slide.id)
                        deselectComponents()
                      }}
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
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 bg-[#07070a]/opacity-0 transition-opacity duration-75 group-hover:pointer-events-auto group-hover:opacity-100">
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

              {canvasFocused && hasComponentSelection && !editingTextId ? (
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
                            findClipartOwner(project.slides, activeClipart.id)
                              ?.id ?? activeSlide.id,
                            activeClipart.id,
                            "cut",
                            activeEdges,
                          )
                      : selectedKind === "text" && activeText
                        ? () =>
                            setTextOverflow(
                              findTextOwner(project.slides, activeText.id)?.id ??
                                activeSlide.id,
                              activeText.id,
                              "cut",
                            )
                        : selectedKind === "lens" && activeLens
                          ? () =>
                              setLensOverflow(
                                findLensOwner(project.slides, activeLens.id)
                                  ?.id ?? activeSlide.id,
                                activeLens.id,
                                "cut",
                              )
                          : activeFrame && selectedKind === "frame"
                            ? () =>
                                setFrameOverflow(
                                  findFrameOwner(project.slides, activeFrame.id)
                                    ?.id ?? activeSlide.id,
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
                            findClipartOwner(project.slides, activeClipart.id)
                              ?.id ?? activeSlide.id,
                            activeClipart.id,
                            "continue",
                            activeEdges,
                          )
                      : selectedKind === "text" && activeText
                        ? () =>
                            setTextOverflow(
                              findTextOwner(project.slides, activeText.id)?.id ??
                                activeSlide.id,
                              activeText.id,
                              "continue",
                            )
                        : selectedKind === "lens" && activeLens
                          ? () =>
                              setLensOverflow(
                                findLensOwner(project.slides, activeLens.id)
                                  ?.id ?? activeSlide.id,
                                activeLens.id,
                                "continue",
                              )
                          : activeFrame && selectedKind === "frame"
                            ? () =>
                                setFrameOverflow(
                                  findFrameOwner(
                                    project.slides,
                                    activeFrame.id,
                                  )?.id ?? activeSlide.id,
                                  activeFrame.id,
                                  "continue",
                                  activeEdges,
                                )
                            : undefined
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {chromeHost
        ? createPortal(
            <div className="flex items-center gap-2">
              <div
                data-canvas-tools
                className="flex items-center gap-0.5 rounded-md border border-white/10 bg-[#0a0a0e] p-0.5"
              >
                <button
                  type="button"
                  title="Select (V)"
                  aria-label="Select tool"
                  aria-pressed={canvasTool === "select"}
                  onClick={() => setCanvasTool("select")}
                  className={`flex h-7 w-7 items-center justify-center rounded ${
                    canvasTool === "select"
                      ? "bg-white/15 text-white"
                      : "text-zinc-400 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M4.5 2.5 19 12.2l-6.4 1.4 3.2 7.3-2.6 1.1-3.2-7.3L4.5 20.5V2.5Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Hand (H) — hold Space to pan temporarily"
                  aria-label="Hand tool"
                  aria-pressed={canvasTool === "hand" || spacePan}
                  onClick={() => setCanvasTool("hand")}
                  className={`flex h-7 w-7 items-center justify-center rounded ${
                    canvasTool === "hand" || spacePan
                      ? "bg-white/15 text-white"
                      : "text-zinc-400 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11" />
                    <path d="M11 10.5V5.5a1.5 1.5 0 0 1 3 0V11" />
                    <path d="M14 10.5V7a1.5 1.5 0 0 1 3 0v6.5" />
                    <path d="M5 12.5V11a1.5 1.5 0 0 1 3 0v1" />
                    <path d="M5 12.5v2a7 7 0 0 0 14 0v-1.5" />
                  </svg>
                </button>
              </div>
              <div
                data-canvas-zoom
                className="flex items-center gap-0.5 rounded-md border border-white/10 bg-[#0a0a0e] p-0.5"
              >
                <button
                  type="button"
                  title="Zoom out"
                  aria-label="Zoom out"
                  disabled={displayZoomPercent <= minZoomPercent}
                  onClick={() => bumpZoom(-1)}
                  className="flex h-7 w-7 items-center justify-center rounded text-zinc-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
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
                  className="min-w-[3.25rem] rounded px-1.5 py-1 text-center font-mono text-[11px] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
                >
                  {displayZoomPercent}%
                </button>
                <button
                  type="button"
                  title="Zoom in"
                  aria-label="Zoom in"
                  disabled={displayZoomPercent >= maxZoomPercent}
                  onClick={() => bumpZoom(1)}
                  className="flex h-7 w-7 items-center justify-center rounded text-zinc-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
                >
                  +
                </button>
                <span className="mx-0.5 h-4 w-px bg-white/10" />
                <button
                  type="button"
                  title="Fit page height"
                  onClick={() => fitToView()}
                  className={`rounded px-2 py-1 text-[11px] hover:bg-white/[0.08] hover:text-white ${
                    zoomMode === "fit"
                      ? "bg-white/15 text-white"
                      : "text-zinc-400"
                  }`}
                >
                  Fit
                </button>
              </div>
            </div>,
            chromeHost,
          )
        : null}
      <p className="pb-3 text-center text-xs text-zinc-500">
        {target.width} × {target.height} · {target.name} · V select · H hand ·
        Space pan · Shift-click multi-select · ⌘/Ctrl+scroll zoom
      </p>
    </section>
  )
}

