import { useEffect, useRef, useState } from "react"
import { VIDEO_FPS, getProjectTarget } from "../constants"
import { projectKindOf } from "../orientation"
import { useProject } from "../project-store"
import {
  slideAtVideoTime,
  totalVideoDurationSec,
} from "../video-tween"
import { Artboard } from "./Artboard"

export function VideoPreviewOverlay({
  playing,
  onClose,
}: {
  playing: boolean
  onClose: () => void
}) {
  const { project, viewProject, assetUrls } = useProject()
  const target = getProjectTarget(project)
  const [timeSec, setTimeSec] = useState(0)
  const startRef = useRef(0)
  const total = totalVideoDurationSec(viewProject.slides)

  useEffect(() => {
    if (!playing) {
      setTimeSec(0)
      return
    }
    startRef.current = performance.now()
    setTimeSec(0)
    let frame = 0
    const tick = (now: number) => {
      const elapsed = (now - startRef.current) / 1000
      if (elapsed >= total) {
        setTimeSec(total)
        onClose()
        return
      }
      setTimeSec(elapsed)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, total, onClose])

  if (projectKindOf(project) !== "video" || !playing) return null

  const pose = slideAtVideoTime(viewProject.slides, timeSec)

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#07070a]/92 backdrop-blur-[2px]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-2">
        <p className="text-xs font-medium text-zinc-300">
          Preview · {timeSec.toFixed(1)}s / {total.toFixed(1)}s
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/[0.06]"
        >
          Stop
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        <div
          className="relative overflow-hidden rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
          style={{
            width: Math.min(target.width, 360),
            height:
              (Math.min(target.width, 360) * target.height) / target.width,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: target.width,
              height: target.height,
              transform: `scale(${Math.min(target.width, 360) / target.width})`,
              transformOrigin: "top left",
            }}
          >
            <Artboard
              slide={pose}
              slides={[pose]}
              width={target.width}
              height={target.height}
              assetUrls={assetUrls}
              forExport
            />
          </div>
        </div>
      </div>
      <div className="shrink-0 px-4 pb-3">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[#e8ff47]"
            style={{
              width: `${total > 0 ? Math.min(100, (timeSec / total) * 100) : 0}%`,
            }}
          />
        </div>
        <p className="mt-1.5 text-center text-[10px] text-zinc-500">
          {VIDEO_FPS} fps · hold each slide, then tween / enter-exit into the next
        </p>
      </div>
    </div>
  )
}
