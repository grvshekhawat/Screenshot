import { useState, type ReactNode } from "react"
import { isImageFile } from "../image-upload"

type ScreenshotDropZoneProps = {
  label: string
  hint?: string
  onClick: () => void
  onDropFiles: (files: FileList | File[]) => void
  className?: string
  children?: ReactNode
}

function hasImageFiles(transfer: DataTransfer): boolean {
  if (transfer.types.includes("Files")) {
    if (transfer.files.length > 0) {
      return [...transfer.files].some(isImageFile)
    }
    // During dragover, files may be empty — accept generic file drags.
    return true
  }
  return false
}

/** Click-or-drop target for replacing / adding a phone screenshot. */
export function ScreenshotDropZone({
  label,
  hint = "or drop an image here",
  onClick,
  onDropFiles,
  className = "",
}: ScreenshotDropZoneProps) {
  const [over, setOver] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onDragEnter={(event) => {
        if (!hasImageFiles(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        setOver(true)
      }}
      onDragOver={(event) => {
        if (!hasImageFiles(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = "copy"
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setOver(false)
        if (!event.dataTransfer.files.length) return
        onDropFiles(event.dataTransfer.files)
      }}
      className={`w-full rounded-lg border border-dashed px-3 py-3 text-sm transition-colors ${
        over
          ? "border-violet-400 bg-violet-500/15 text-white"
          : "border-zinc-700 text-zinc-300 hover:border-violet-500 hover:text-white"
      } ${className}`}
    >
      <span className="block font-medium">{label}</span>
      <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
        {over ? "Drop to upload" : hint}
      </span>
    </button>
  )
}

/** Resolve drop target from DOM under the cursor (frame + optional A/B slot). */
export function screenshotDropTargetFromEvent(event: {
  target: EventTarget | null
}): {
  frameId?: string
  slot?: "a" | "b"
  slideId?: string
} {
  const el =
    event.target instanceof Element
      ? event.target
      : event.target instanceof Node
        ? event.target.parentElement
        : null
  if (!el) return {}
  const frameEl = el.closest("[data-frame-id]")
  const slotEl = el.closest("[data-screen-slot]")
  const slideEl = el.closest("[data-slide-id]")
  const slotAttr = slotEl?.getAttribute("data-screen-slot")
  return {
    frameId: frameEl?.getAttribute("data-frame-id") ?? undefined,
    slot: slotAttr === "a" || slotAttr === "b" ? slotAttr : undefined,
    slideId: slideEl?.getAttribute("data-slide-id") ?? undefined,
  }
}
