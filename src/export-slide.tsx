import { createRoot, type Root } from "react-dom/client"
import { Artboard } from "./components/Artboard"
import { canvasToOpaquePng, captureArtboardDom } from "./export-canvas"
import {
  guestClipartsForSlide,
  guestFramesForSlide,
  guestLensesForSlide,
  guestTextsForSlide,
} from "./overflow"
import type { Slide } from "./types"

type ExportSlideProps = {
  slide: Slide
  slideIndex: number
  slides: Slide[]
  width: number
  height: number
  assetUrls: Record<string, string>
  showLenses?: boolean
  /** Continuity offset between slides; >100 when a gap sits between artboards. */
  stridePercent?: number
  onReady?: () => void
}

function ExportSlide({
  slide,
  slideIndex,
  slides,
  width,
  height,
  assetUrls,
  showLenses = true,
  stridePercent = 100,
  onReady,
}: ExportSlideProps) {
  const guestFrames = guestFramesForSlide(
    slides,
    slideIndex,
    width,
    height,
    stridePercent,
  )
  const guestCliparts = guestClipartsForSlide(
    slides,
    slideIndex,
    width,
    height,
    stridePercent,
  )
  const guestTexts = guestTextsForSlide(
    slides,
    slideIndex,
    width,
    height,
    stridePercent,
  )
  const guestLenses = guestLensesForSlide(
    slides,
    slideIndex,
    width,
    height,
    stridePercent,
  )
  return (
    <Artboard
      slide={slide}
      slides={slides}
      width={width}
      height={height}
      assetUrls={assetUrls}
      guestFrames={guestFrames}
      guestCliparts={guestCliparts}
      guestTexts={guestTexts}
      guestLenses={guestLenses}
      showLenses={showLenses}
      forExport
      onReady={onReady}
    />
  )
}

let captureLock: Promise<void> = Promise.resolve()

function withCaptureLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = captureLock.then(fn, fn)
  captureLock = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

type OffscreenCaptureSession = {
  host: HTMLDivElement
  root: Root
  width: number
  height: number
}

function createExportHost(width: number, height: number): HTMLDivElement {
  const host = document.createElement("div")
  host.setAttribute("data-export-host", "true")
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${width}px`,
    `height:${height}px`,
    "overflow:hidden",
    "pointer-events:none",
    "z-index:-1",
  ].join(";")
  document.body.appendChild(host)
  return host
}

async function renderExportSlide(
  root: Root,
  host: HTMLDivElement,
  props: Omit<ExportSlideProps, "onReady">,
  waitForAssets: boolean,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Timed out rendering artboard")),
      20000,
    )
    const onReady = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    root.render(<ExportSlide {...props} onReady={onReady} />)
  })

  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))

  if (waitForAssets) {
    const bakeDeadline = Date.now() + 4000
    while (Date.now() < bakeDeadline) {
      if (!host.querySelector("[data-clipart-baking]")) break
      await new Promise((resolve) => setTimeout(resolve, 32))
    }
    await Promise.all(
      [...host.querySelectorAll("img")].map((img) =>
        img.decode().catch(() => undefined),
      ),
    )
  }
}

function pinArtboardSize(
  host: HTMLDivElement,
  width: number,
  height: number,
): HTMLElement {
  const artboard = host.querySelector("[data-artboard]")
  if (!(artboard instanceof HTMLElement)) {
    throw new Error("Artboard element missing")
  }
  artboard.style.width = `${width}px`
  artboard.style.height = `${height}px`
  artboard.style.maxWidth = `${width}px`
  artboard.style.maxHeight = `${height}px`
  artboard.style.transform = "none"
  artboard.style.zoom = "1"
  return artboard
}

export function createOffscreenCaptureSession(
  width: number,
  height: number,
): OffscreenCaptureSession {
  const host = createExportHost(width, height)
  return { host, root: createRoot(host), width, height }
}

export function destroyOffscreenCaptureSession(
  session: OffscreenCaptureSession,
): void {
  session.root.unmount()
  session.host.remove()
}

/**
 * Render a pose into an existing offscreen session. First call waits for
 * images; later pose updates skip the long bake so video preview stays live.
 */
export async function captureSlideInSession(
  session: OffscreenCaptureSession,
  slide: Slide,
  slideIndex: number,
  slides: Slide[],
  assetUrls: Record<string, string>,
  options?: { waitForAssets?: boolean; showLenses?: boolean; isolate?: boolean },
): Promise<HTMLCanvasElement> {
  const waitForAssets = options?.waitForAssets ?? false
  const poseSlides = options?.isolate ? [slide] : slides
  const poseIndex = options?.isolate ? 0 : slideIndex
  await renderExportSlide(
    session.root,
    session.host,
    {
      slide,
      slideIndex: poseIndex,
      slides: poseSlides,
      width: session.width,
      height: session.height,
      assetUrls,
      showLenses: options?.showLenses ?? true,
      stridePercent: 100,
    },
    waitForAssets,
  )
  const artboard = pinArtboardSize(session.host, session.width, session.height)
  const needsPrep =
    waitForAssets || Boolean(session.host.querySelector("[data-screen-fit]"))
  return captureArtboardDom(artboard, session.width, session.height, {
    prepareAssets: needsPrep,
  })
}

/** Rasterize one slide exactly as the editor/export artboard (all devices, clipart, lenses). */
export async function captureSlideToCanvas(
  slide: Slide,
  slideIndex: number,
  slides: Slide[],
  width: number,
  height: number,
  assetUrls: Record<string, string>,
  showLenses = true,
  stridePercent = 100,
): Promise<HTMLCanvasElement> {
  return withCaptureLock(async () => {
    const session = createOffscreenCaptureSession(width, height)
    try {
      await renderExportSlide(
        session.root,
        session.host,
        {
          slide,
          slideIndex,
          slides,
          width,
          height,
          assetUrls,
          showLenses,
          stridePercent,
        },
        true,
      )
      const artboard = pinArtboardSize(session.host, width, height)
      return await captureArtboardDom(artboard, width, height)
    } finally {
      destroyOffscreenCaptureSession(session)
    }
  })
}

export async function renderOffscreenArtboard(
  slide: Slide,
  slideIndex: number,
  slides: Slide[],
  width: number,
  height: number,
  assetUrls: Record<string, string>,
  showLenses = true,
  options?: { watermark?: boolean },
): Promise<Blob> {
  const canvas = await captureSlideToCanvas(
    slide,
    slideIndex,
    slides,
    width,
    height,
    assetUrls,
    showLenses,
  )
  return canvasToOpaquePng(canvas, width, height, {
    watermark: options?.watermark,
  })
}
