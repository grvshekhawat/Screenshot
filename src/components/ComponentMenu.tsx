import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  canCopyComponentToSlide,
  DEVICES,
  layerMoveLimits,
  MAX_CLIPARTS,
  MAX_FRAMES,
  MAX_LENSES,
  MAX_TEXTS,
} from "../constants"
import type {
  ClipartLayer,
  Frame,
  LensLayer,
  Slide,
  TextLayer,
  SelectedKind,
} from "../types"
import { lensPixelSize } from "./PlacedLens"

type ComponentMenuProps = {
  kind: SelectedKind
  frame: Frame | null
  text: TextLayer | null
  clipart: ClipartLayer | null
  lens: LensLayer | null
  previewWidth: number
  previewHeight: number
  canDuplicate: boolean
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  slides: Slide[]
  currentSlideId: string
  /** Shift menu when rendered on the multi-slide track */
  offsetLeft?: number
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onCopyToSlide: (targetSlideId: string) => void
  onCut?: () => void
  onContinue?: () => void
}

export function ComponentMenu({
  kind,
  frame,
  text,
  clipart,
  lens,
  previewWidth,
  previewHeight,
  canDuplicate,
  canDelete,
  canMoveUp,
  canMoveDown,
  slides,
  currentSlideId,
  offsetLeft = 0,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onCopyToSlide,
  onCut,
  onContinue,
}: ComponentMenuProps) {
  const [copyOpen, setCopyOpen] = useState(false)
  const copyRef = useRef<HTMLDivElement>(null)
  const showContinuity =
    ((kind === "frame" && frame) || (kind === "clipart" && clipart)) &&
    onCut &&
    onContinue
  const continuityMode =
    kind === "clipart" && clipart
      ? clipart.overflow
      : kind === "frame" && frame
        ? frame.overflow
        : "cut"
  const otherSlides = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide.id !== currentSlideId)
  const canCopy =
    otherSlides.length > 0 &&
    otherSlides.some(({ slide }) => canCopyComponentToSlide(kind, slide))
  const buttonCount = 5 + (showContinuity ? 2 : 0)
  const menuWidth = buttonCount * 26 + 6
  const menuHeight = 28
  const anchor = menuAnchor({
    kind,
    frame,
    text,
    clipart,
    lens,
    previewWidth,
    previewHeight,
    menuWidth,
    menuHeight,
  })

  useEffect(() => {
    if (!copyOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (copyRef.current?.contains(event.target as Node)) return
      setCopyOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [copyOpen])

  useEffect(() => {
    setCopyOpen(false)
  }, [currentSlideId, frame?.id, text?.id, clipart?.id, lens?.id])

  if (!anchor) return null

  return (
    <div
      data-component-menu
      className="absolute z-[300] flex items-center gap-px rounded-md bg-zinc-950/95 p-0.5 shadow-[0_8px_20px_rgba(0,0,0,0.5)] ring-1 ring-white/12 backdrop-blur-sm"
      style={{ left: anchor.left + offsetLeft, top: anchor.top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <IconButton
        label="Duplicate"
        disabled={!canDuplicate}
        onClick={onDuplicate}
      >
        <DuplicateIcon />
      </IconButton>
      <div className="relative" ref={copyRef}>
        <IconButton
          label="Copy to slide"
          disabled={!canCopy}
          active={copyOpen}
          onClick={() => setCopyOpen((open) => !open)}
        >
          <CopyToIcon />
        </IconButton>
        {copyOpen ? (
          <div className="absolute left-1/2 top-full z-40 mt-1 min-w-[7.5rem] -translate-x-1/2 rounded-md bg-zinc-950 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.55)] ring-1 ring-white/12">
            {otherSlides.map(({ slide, index }) => {
              const enabled = canCopyComponentToSlide(kind, slide)
              return (
                <button
                  key={slide.id}
                  type="button"
                  disabled={!enabled}
                  title={
                    enabled
                      ? `Copy to slide ${index + 1}`
                      : `Slide ${index + 1} is full`
                  }
                  onClick={() => {
                    onCopyToSlide(slide.id)
                    setCopyOpen(false)
                  }}
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-[11px] text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Slide {index + 1}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      <IconButton label="Move up" disabled={!canMoveUp} onClick={onMoveUp}>
        <UpIcon />
      </IconButton>
      <IconButton
        label="Move down"
        disabled={!canMoveDown}
        onClick={onMoveDown}
      >
        <DownIcon />
      </IconButton>
      {showContinuity ? (
        <>
          <span className="mx-0.5 h-3.5 w-px bg-white/15" />
          <IconButton
            label="Cut overflow"
            active={continuityMode === "cut"}
            onClick={onCut}
          >
            <CutIcon />
          </IconButton>
          <IconButton
            label="Continue across slides"
            active={continuityMode === "continue"}
            onClick={onContinue}
          >
            <ContinueIcon />
          </IconButton>
        </>
      ) : null}
      <span className="mx-0.5 h-3.5 w-px bg-white/15" />
      <IconButton
        label="Delete"
        disabled={!canDelete}
        danger
        onClick={onDelete}
      >
        <DeleteIcon />
      </IconButton>
    </div>
  )
}

export function menuLimits(slide: Slide, kind: SelectedKind, id: string) {
  const move = layerMoveLimits(slide, id)
  if (kind === "frame") {
    return {
      canDuplicate: slide.frames.length < MAX_FRAMES,
      canDelete: true,
      ...move,
    }
  }
  if (kind === "clipart") {
    return {
      canDuplicate: slide.cliparts.length < MAX_CLIPARTS,
      canDelete: true,
      ...move,
    }
  }
  if (kind === "lens") {
    return {
      canDuplicate: (slide.lenses ?? []).length < MAX_LENSES,
      canDelete: true,
      ...move,
    }
  }
  return {
    canDuplicate: slide.texts.length < MAX_TEXTS,
    canDelete: true,
    ...move,
  }
}

function menuAnchor({
  kind,
  frame,
  text,
  clipart,
  lens,
  previewWidth,
  previewHeight,
  menuWidth,
  menuHeight,
}: {
  kind: SelectedKind
  frame: Frame | null
  text: TextLayer | null
  clipart: ClipartLayer | null
  lens: LensLayer | null
  previewWidth: number
  previewHeight: number
  menuWidth: number
  menuHeight: number
}) {
  if (kind === "frame" && frame) {
    const spec = DEVICES[frame.deviceId]
    const deviceW = previewWidth * frame.scale
    const deviceH = deviceW / spec.aspect
    const cx = (frame.x / 100) * previewWidth
    const cy = (frame.y / 100) * previewHeight
    return clampAnchor(
      cx - menuWidth / 2,
      cy - deviceH / 2 - menuHeight - 6,
      menuWidth,
      menuHeight,
      previewWidth,
      previewHeight,
    )
  }

  if (kind === "clipart" && clipart) {
    const aspect =
      Number.isFinite(clipart.aspect) && clipart.aspect > 0 ? clipart.aspect : 1
    const cx = (clipart.x / 100) * previewWidth
    const cy = (clipart.y / 100) * previewHeight
    const clipartW = (clipart.width / 100) * previewWidth
    const clipartH = clipartW / aspect
    return clampAnchor(
      cx - menuWidth / 2,
      cy - clipartH / 2 - menuHeight - 6,
      menuWidth,
      menuHeight,
      previewWidth,
      previewHeight,
    )
  }

  if (kind === "lens" && lens) {
    const cx = (lens.x / 100) * previewWidth
    const cy = (lens.y / 100) * previewHeight
    const size = lensPixelSize(lens, previewWidth, previewHeight)
    return clampAnchor(
      cx - menuWidth / 2,
      cy - size.height / 2 - menuHeight - 6,
      menuWidth,
      menuHeight,
      previewWidth,
      previewHeight,
    )
  }

  if (kind === "text" && text) {
    const cx = (text.x / 100) * previewWidth
    const cy = (text.y / 100) * previewHeight
    return clampAnchor(
      cx - menuWidth / 2,
      cy - 28 - menuHeight,
      menuWidth,
      menuHeight,
      previewWidth,
      previewHeight,
    )
  }

  return null
}

function clampAnchor(
  left: number,
  top: number,
  menuWidth: number,
  menuHeight: number,
  previewWidth: number,
  previewHeight: number,
) {
  return {
    left: Math.min(previewWidth - 8, Math.max(4 - menuWidth + 24, left)),
    top: Math.min(
      Math.max(4, previewHeight - menuHeight),
      Math.max(-menuHeight - 4, top),
    ),
  }
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  active,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-violet-600 text-white"
          : danger
            ? "text-red-400 hover:bg-red-500/15 hover:text-red-300"
            : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  )
}

function DuplicateIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" />
      <path d="M8.5 3.5V2.5A1 1 0 0 0 7.5 1.5H2.5A1 1 0 0 0 1.5 2.5v5a1 1 0 0 0 1 1h1" stroke="currentColor" />
    </svg>
  )
}

function CopyToIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="3.5" width="6" height="7" rx="1" stroke="currentColor" />
      <path
        d="M4.5 3.5V2.5A1 1 0 0 1 5.5 1.5h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9"
        stroke="currentColor"
      />
      <path
        d="M7.5 6.5h3M9 5l1.5 1.5L9 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 2.5v7M3 5.5 6 2.5l3 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 9.5v-7M3 6.5 6 9.5l3-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CutIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeDasharray="2 1.5" />
    </svg>
  )
}

function ContinueIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 6h7.5M6.5 3.5 9.5 6l-3 2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 3.5h7M5 3.5V2.5h2v1M4 5v4M6 5v4M8 5v4M3.5 3.5l.5 7h4l.5-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
