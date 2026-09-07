import { createFrame } from "./constants"
import type { FrameScreenSlot, Project, Slide } from "./types"

export type ScreenshotSlot = {
  slideId: string
  frameId: string
  slot: FrameScreenSlot
}

/** Screens a bulk upload may take over: empty, seed mock, or template copy. */
function replaceableIds(project: Project): Set<string> {
  return new Set(project.templateScreenshotIds ?? [])
}

function slotIsFree(
  assetId: string | null | undefined,
  replaceable: Set<string>,
): boolean {
  if (!assetId) return true
  // Built-in seed templates keep their mock ids; cloud templates are remapped.
  if (assetId.startsWith("sample-")) return true
  return replaceable.has(assetId)
}

/** Phone screens a bulk upload can fill, in slide then frame order. */
export function availableScreenshotSlots(project: Project): ScreenshotSlot[] {
  const replaceable = replaceableIds(project)
  const slots: ScreenshotSlot[] = []
  for (const slide of project.slides) {
    for (const frame of slide.frames) {
      if (slotIsFree(frame.screenshotId, replaceable)) {
        slots.push({ slideId: slide.id, frameId: frame.id, slot: "a" })
      }
      if (
        frame.screenMode === "split" &&
        slotIsFree(frame.screenshotIdB, replaceable)
      ) {
        slots.push({ slideId: slide.id, frameId: frame.id, slot: "b" })
      }
    }
  }
  return slots
}

function screenshotIdsOnFrames(slides: Slide[]): Set<string> {
  const ids = new Set<string>()
  for (const slide of slides) {
    for (const frame of slide.frames) {
      if (frame.screenshotId) ids.add(frame.screenshotId)
      if (frame.screenshotIdB) ids.add(frame.screenshotIdB)
    }
  }
  return ids
}

/** Fill free phone screens with `assetIds` in order; extras are left unused. */
export function assignScreenshotsToFreeSlots(
  project: Project,
  assetIds: string[],
): Project {
  const slots = availableScreenshotSlots(project)
  if (slots.length === 0 || assetIds.length === 0) return project

  const patches = new Map<string, { a?: string; b?: string }>()
  slots.slice(0, assetIds.length).forEach((target, index) => {
    const key = `${target.slideId}:${target.frameId}`
    const patch = patches.get(key) ?? {}
    patch[target.slot] = assetIds[index]!
    patches.set(key, patch)
  })

  const slides = project.slides.map((slide) => ({
    ...slide,
    frames: slide.frames.map((frame) => {
      const patch = patches.get(`${slide.id}:${frame.id}`)
      if (!patch) return frame
      return createFrame({
        ...frame,
        ...(patch.a ? { screenshotId: patch.a } : {}),
        ...(patch.b ? { screenshotIdB: patch.b } : {}),
      })
    }),
  }))

  // Drop placeholders that no longer sit on any phone.
  const stillPlaced = screenshotIdsOnFrames(slides)
  return {
    ...project,
    slides,
    templateScreenshotIds: (project.templateScreenshotIds ?? []).filter((id) =>
      stillPlaced.has(id),
    ),
  }
}
