import type { OverflowEdges } from "../overflow"

export function OverflowChoice({
  mode,
  edges,
  noun = "item",
  onCut,
  onContinue,
}: {
  mode: "cut" | "continue"
  edges: OverflowEdges
  /** e.g. "phone", "text", "clipart", "lens" */
  noun?: string
  onCut: () => void
  onContinue: () => void
}) {
  const direction =
    edges.left && edges.right
      ? "both edges"
      : edges.right
        ? "the next slide"
        : "the previous slide"

  return (
    <div className="rounded-lg bg-zinc-900 p-2 ring-1 ring-amber-500/40">
      <p className="px-1 text-[11px] leading-snug text-zinc-300">
        This {noun} goes outside the screenshot.
      </p>
      <div className="mt-2 flex gap-1">
        <button
          type="button"
          onClick={onCut}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs ${
            mode === "cut"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Cut
        </button>
        <button
          type="button"
          onClick={onContinue}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs ${
            mode === "continue"
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Continue
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[10px] leading-snug text-zinc-500">
        Cut clips it here. Continue paints the overflow on {direction}
        {mode !== "continue" ? " (adds a slide if needed)" : ""}.
      </p>
    </div>
  )
}
