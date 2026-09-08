import { saveAs } from "file-saver"
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeVideo,
  getFirstEncodableVideoCodec,
} from "mediabunny"
import {
  STORE_TARGETS,
  VIDEO_DURATION_DEFAULT,
  clampVideoDurationSec,
} from "./constants"
import { captureSlideToCanvas } from "./export-slide"
import { projectKindOf } from "./orientation"
import type { Project } from "./types"

export function canExportVideoInBrowser(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined"
}

/**
 * Render each slide once, then encode an MP4 where each slide holds for
 * `durationSec` (hard cuts). Requires WebCodecs H.264 (Chrome/Edge/Firefox).
 */
export async function downloadProjectVideo(
  project: Project,
  assetUrls: Record<string, string>,
  onProgress?: (label: string) => void,
): Promise<void> {
  if (projectKindOf(project) !== "video") {
    throw new Error("Only video projects can export MP4")
  }
  if (!canExportVideoInBrowser()) {
    throw new Error(
      "Video export needs a browser with WebCodecs (Chrome, Edge, or Firefox).",
    )
  }

  const target = STORE_TARGETS[project.targetId] ?? STORE_TARGETS["video-9x16"]
  const width = target.width
  const height = target.height
  const slides = project.slides
  if (!slides.length) throw new Error("No slides to export")

  const codec =
    (await getFirstEncodableVideoCodec(["avc"], { width, height })) ??
    (await getFirstEncodableVideoCodec(["vp9", "av1"], { width, height }))
  if (!codec || !(await canEncodeVideo(codec, { width, height }))) {
    throw new Error(
      "This browser cannot encode video at 1080×1920. Try Chrome or Edge.",
    )
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not create video canvas")

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  })
  const videoSource = new CanvasSource(canvas, {
    codec,
    quality: QUALITY_HIGH,
  })
  output.addVideoTrack(videoSource)
  await output.start()

  let timestamp = 0
  for (const [index, slide] of slides.entries()) {
    onProgress?.(
      `Rendering slide ${index + 1}/${slides.length}…`,
    )
    const captured = await captureSlideToCanvas(
      slide,
      index,
      slides,
      width,
      height,
      assetUrls,
      true,
      100,
    )
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(captured, 0, 0, width, height)

    const duration = clampVideoDurationSec(
      slide.durationSec ?? VIDEO_DURATION_DEFAULT,
    )
    onProgress?.(
      `Encoding slide ${index + 1}/${slides.length} (${duration}s)…`,
    )
    await videoSource.add(timestamp, duration)
    timestamp += duration
  }

  onProgress?.("Finalizing MP4…")
  await videoSource.close()
  await output.finalize()

  const buffer = output.target.buffer
  if (!buffer) throw new Error("Video encoding produced an empty file")
  const blob = new Blob([buffer], { type: "video/mp4" })
  const safeName = (project.name || "video")
    .trim()
    .replace(/[^\w\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  saveAs(blob, `${safeName || "app-video"}.mp4`)
}
