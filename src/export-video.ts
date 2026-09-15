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
import { VIDEO_FPS, getProjectTarget } from "./constants"
import {
  captureSlideInSession,
  createOffscreenCaptureSession,
  destroyOffscreenCaptureSession,
} from "./export-slide"
import { projectKindOf } from "./orientation"
import type { Project } from "./types"
import { slideAtVideoTime, videoFrameTimes } from "./video-tween"

export function canExportVideoInBrowser(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined"
}

const FRAME_DURATION = 1 / VIDEO_FPS

/**
 * Interpolate matching phones (position, scale, rotation / tilt) between
 * slides, capture each 30fps pose, encode H.264 MP4.
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

  const target = getProjectTarget(project)
  const width = target.width
  const height = target.height
  const slides = project.slides
  if (!slides.length) throw new Error("No slides to export")

  const codec =
    (await getFirstEncodableVideoCodec(["avc"], { width, height })) ??
    (await getFirstEncodableVideoCodec(["vp9", "av1"], { width, height }))
  if (!codec || !(await canEncodeVideo(codec, { width, height }))) {
    throw new Error(
      "This browser cannot encode video at 886×1920. Try Chrome or Edge.",
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

  const times = videoFrameTimes(slides)
  const session = createOffscreenCaptureSession(width, height)
  try {
    for (const [index, timeSec] of times.entries()) {
      if (index === 0 || index % 8 === 0) {
        onProgress?.(
          `Rendering frame ${index + 1}/${times.length}…`,
        )
      }
      const pose = slideAtVideoTime(slides, timeSec)
      const captured = await captureSlideInSession(
        session,
        pose,
        0,
        [pose],
        assetUrls,
        {
          waitForAssets: index === 0,
          isolate: true,
        },
      )
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(captured, 0, 0, width, height)
      await videoSource.add(timeSec, FRAME_DURATION)
    }
  } finally {
    destroyOffscreenCaptureSession(session)
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
