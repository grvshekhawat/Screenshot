import { createRoot } from "react-dom/client"
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
            stridePercent={stridePercent}
            onReady={onReady}
          />,
        )
      })

      await new Promise((resolve) => requestAnimationFrame(resolve))
      await new Promise((resolve) => requestAnimationFrame(resolve))

      // Recolored cliparts bake to <img> asynchronously — wait so thumbnails
      // don't capture empty placeholders.
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

      const artboard = host.querySelector("[data-artboard]")
      if (!(artboard instanceof HTMLElement)) {
        throw new Error("Artboard element missing")
      }

      return await captureArtboardDom(artboard, width, height)
    } finally {
      root.unmount()
      host.remove()
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
