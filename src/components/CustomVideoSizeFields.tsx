import { useEffect, useState } from "react"
import {
  VIDEO_CUSTOM_HEIGHT_DEFAULT,
  VIDEO_CUSTOM_SIZE_MAX,
  VIDEO_CUSTOM_SIZE_MIN,
  VIDEO_CUSTOM_WIDTH_DEFAULT,
  clampVideoCustomSize,
} from "../constants"

type CustomVideoSizeFieldsProps = {
  width: number
  height: number
  onApply: (width: number, height: number) => void
  /** Compact header layout vs Timeline panel. */
  compact?: boolean
}

/**
 * Draft width/height inputs — commits only when Apply is clicked.
 */
export function CustomVideoSizeFields({
  width,
  height,
  onApply,
  compact = false,
}: CustomVideoSizeFieldsProps) {
  const appliedW = clampVideoCustomSize(width, VIDEO_CUSTOM_WIDTH_DEFAULT)
  const appliedH = clampVideoCustomSize(height, VIDEO_CUSTOM_HEIGHT_DEFAULT)
  const [draftW, setDraftW] = useState(String(appliedW))
  const [draftH, setDraftH] = useState(String(appliedH))

  useEffect(() => {
    setDraftW(String(appliedW))
    setDraftH(String(appliedH))
  }, [appliedW, appliedH])

  const parsedW = Number(draftW)
  const parsedH = Number(draftH)
  const nextW = clampVideoCustomSize(parsedW, appliedW)
  const nextH = clampVideoCustomSize(parsedH, appliedH)
  const dirty = nextW !== appliedW || nextH !== appliedH
  const valid =
    Number.isFinite(parsedW) &&
    Number.isFinite(parsedH) &&
    parsedW >= VIDEO_CUSTOM_SIZE_MIN &&
    parsedW <= VIDEO_CUSTOM_SIZE_MAX &&
    parsedH >= VIDEO_CUSTOM_SIZE_MIN &&
    parsedH <= VIDEO_CUSTOM_SIZE_MAX

  const apply = () => {
    if (!valid) return
    onApply(nextW, nextH)
  }

  if (compact) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-zinc-400">
        <input
          type="number"
          min={VIDEO_CUSTOM_SIZE_MIN}
          max={VIDEO_CUSTOM_SIZE_MAX}
          value={draftW}
          onChange={(event) => setDraftW(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") apply()
          }}
          className="w-16 rounded-md border border-white/10 bg-[#0a0a0e] px-1.5 py-1 text-xs text-zinc-200"
          aria-label="Custom width"
        />
        ×
        <input
          type="number"
          min={VIDEO_CUSTOM_SIZE_MIN}
          max={VIDEO_CUSTOM_SIZE_MAX}
          value={draftH}
          onChange={(event) => setDraftH(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") apply()
          }}
          className="w-16 rounded-md border border-white/10 bg-[#0a0a0e] px-1.5 py-1 text-xs text-zinc-200"
          aria-label="Custom height"
        />
        <button
          type="button"
          disabled={!dirty || !valid}
          onClick={apply}
          className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-40"
        >
          Apply
        </button>
      </span>
    )
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label className="text-[11px] text-zinc-500">
        Width
        <input
          type="number"
          min={VIDEO_CUSTOM_SIZE_MIN}
          max={VIDEO_CUSTOM_SIZE_MAX}
          step={1}
          value={draftW}
          onChange={(event) => setDraftW(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") apply()
          }}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#07070a] px-2.5 py-2 text-sm text-white outline-none"
        />
      </label>
      <label className="text-[11px] text-zinc-500">
        Height
        <input
          type="number"
          min={VIDEO_CUSTOM_SIZE_MIN}
          max={VIDEO_CUSTOM_SIZE_MAX}
          step={1}
          value={draftH}
          onChange={(event) => setDraftH(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") apply()
          }}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#07070a] px-2.5 py-2 text-sm text-white outline-none"
        />
      </label>
      <div className="col-span-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-zinc-600">
          {VIDEO_CUSTOM_SIZE_MIN}–{VIDEO_CUSTOM_SIZE_MAX} px · applied{" "}
          {appliedW}×{appliedH}
        </p>
        <button
          type="button"
          disabled={!dirty || !valid}
          onClick={apply}
          className="shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  )
}
