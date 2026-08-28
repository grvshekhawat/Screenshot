import { createRoot } from "react-dom/client"
import JSZip from "jszip"
import { saveAs } from "file-saver"
import { Artboard } from "./components/Artboard"
import { STORE_TARGETS } from "./constants"
import { canvasToOpaquePng, captureArtboardDom } from "./export-canvas"
import { guestClipartsForSlide, guestFramesForSlide } from "./overflow"
import {
  projectOrientation,
  storeTargetIdsForOrientation,
} from "./orientation"
import { projectForExportTarget } from "./size-layouts"
import type { Project, Slide, StoreTargetId } from "./types"

type ExportSlideProps = {
  slide: Slide
  slideIndex: number
  slides: Slide[]
  width: number
  height: number
  assetUrls: Record<string, string>
  showLenses?: boolean
  onReady?: () => void
}

type ExportOptions = {
  watermark?: boolean
}

function ExportSlide({
  slide,
  slideIndex,
  slides,
  width,
  height,
  assetUrls,
  showLenses = true,
  onReady,
}: ExportSlideProps) {
  const guestFrames = guestFramesForSlide(slides, slideIndex, width, height)
  const guestCliparts = guestClipartsForSlide(slides, slideIndex, width, height)
  return (
    <Artboard
      slide={slide}
      slides={slides}
      width={width}
      height={height}
      assetUrls={assetUrls}
      guestFrames={guestFrames}
      guestCliparts={guestCliparts}
      showLenses={showLenses}
      forExport
      onReady={onReady}
    />
  )
}

async function renderOffscreenArtboard(
  slide: Slide,
  slideIndex: number,
  slides: Slide[],
  width: number,
  height: number,
  assetUrls: Record<string, string>,
  showLenses = true,
  options?: ExportOptions,
): Promise<Blob> {
  const host = document.createElement("div")
  host.setAttribute("data-export-host", "true")
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${width}px`,
    `height:${height}px`,
    "overflow:hidden",
    "pointer-events:none",
    "z-index:-1",
  ].join(";")
  document.body.appendChild(host)
  const root = createRoot(host)

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Timed out rendering artboard")),
        20000,
      )
      const onReady = () => {
        window.clearTimeout(timeout)
        resolve()
      }

      root.render(
        <ExportSlide
          slide={slide}
          slideIndex={slideIndex}
          slides={slides}
          width={width}
          height={height}
          assetUrls={assetUrls}
          showLenses={showLenses}
          onReady={onReady}
        />,
      )
    })

    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const artboard = host.querySelector("[data-artboard]")
    if (!(artboard instanceof HTMLElement)) {
      throw new Error("Artboard element missing")
    }

    const canvas = await captureArtboardDom(artboard, width, height)
    return canvasToOpaquePng(canvas, width, height, {
      watermark: options?.watermark,
    })
  } finally {
    root.unmount()
    host.remove()
  }
}

/** Snapshot of slide content (no lenses) — used when locking a lens image. */
export async function captureSlideSnapshot(
  slide: Slide,
  slideIndex: number,
  slides: Slide[],
  targetId: StoreTargetId,
  assetUrls: Record<string, string>,
): Promise<Blob> {
  const size = STORE_TARGETS[targetId]
  return renderOffscreenArtboard(
    slide,
    slideIndex,
    slides,
    size.width,
    size.height,
    assetUrls,
    false,
  )
}

export async function renderSlidePng(
  slide: Slide,
  targetId: StoreTargetId,
  assetUrls: Record<string, string>,
  project?: Project,
  options?: ExportOptions,
): Promise<Blob> {
  const size = STORE_TARGETS[targetId]
  const adapted = project
    ? projectForExportTarget(project, targetId)
    : {
        name: "export",
        targetId,
        designTargetId: targetId,
        sizeEditMode: "current" as const,
        activeSlideId: slide.id,
        slides: [slide],
        sizeLayouts: {
          [targetId]: { slides: [slide], activeSlideId: slide.id },
        },
      }
  const slideIndex = adapted.slides.findIndex((item) => item.id === slide.id)
  const index = slideIndex >= 0 ? slideIndex : 0
  const adaptedSlide = adapted.slides[index] ?? adapted.slides[0]

  return renderOffscreenArtboard(
    adaptedSlide,
    index,
    adapted.slides,
    size.width,
    size.height,
    assetUrls,
    true,
    options,
  )
}

function slideFileName(index: number, headline: string): string {
  const slug = headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  const num = String(index + 1).padStart(2, "0")
  return slug ? `${num}-${slug}.png` : `${num}.png`
}

function projectSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "screenshots"
  )
}

export async function downloadSlidePng(
  slide: Slide,
  targetId: StoreTargetId,
  assetUrls: Record<string, string>,
  index: number,
  project?: Project,
  options?: ExportOptions,
): Promise<void> {
  const blob = await renderSlidePng(
    slide,
    targetId,
    assetUrls,
    project,
    options,
  )
  const base = slideFileName(index, slide.texts[0]?.content ?? "")
  const name = options?.watermark
    ? base.replace(/\.png$/i, "-preview.png")
    : base
  saveAs(blob, name)
}

export async function downloadProjectZip(
  project: Project,
  assetUrls: Record<string, string>,
  onProgress?: (label: string) => void,
  options?: ExportOptions & { allSizes?: boolean },
): Promise<void> {
  const zip = new JSZip()
  const targets = options?.allSizes
    ? storeTargetIdsForOrientation(projectOrientation(project))
    : [project.targetId]
  const adaptedTargets = targets.map((targetId) => ({
    targetId,
    adapted: projectForExportTarget(project, targetId),
  }))
  const total = adaptedTargets.reduce(
    (sum, entry) => sum + entry.adapted.slides.length,
    0,
  )
  let done = 0

  for (const { targetId, adapted } of adaptedTargets) {
    const target = STORE_TARGETS[targetId]
    const folder = zip.folder(target.folder)
    if (!folder) throw new Error("Could not create ZIP folder")

    for (const [index, slide] of adapted.slides.entries()) {
      done += 1
      onProgress?.(
        targets.length > 1
          ? `Exporting ${done}/${total} · ${target.name}`
          : `Exporting ${index + 1}/${adapted.slides.length}`,
      )
      const blob = await renderSlidePng(
        slide,
        targetId,
        assetUrls,
        adapted,
        options,
      )
      folder.file(slideFileName(index, slide.texts[0]?.content ?? ""), blob)
    }
  }

  onProgress?.("Packing ZIP")
  const archive = await zip.generateAsync({ type: "blob" })
  const slug = projectSlug(project.name)
  const suffix = options?.allSizes
    ? "all-sizes"
    : STORE_TARGETS[project.targetId].folder.replace(/\//g, "-")
  saveAs(archive, `${slug}-${suffix}.zip`)
}
