import type { Project, Slide } from "./types"

function collectSlideAssets(slide: Slide, ids: Set<string>) {
  if (slide.background.imageId) ids.add(slide.background.imageId)
  for (const frame of slide.frames) {
    if (frame.screenshotId) ids.add(frame.screenshotId)
    if (frame.screenshotIdB) ids.add(frame.screenshotIdB)
  }
  for (const clipart of slide.cliparts) {
    ids.add(clipart.assetId)
  }
  for (const lens of slide.lenses ?? []) {
    if (lens.lockedImageId) ids.add(lens.lockedImageId)
  }
}

/** Assets needed to render the currently visible slides (active size). */
export function assetIdsFromActiveLayout(project: Project): string[] {
  const ids = new Set<string>()
  for (const slide of project.slides) {
    collectSlideAssets(slide, ids)
  }
  return [...ids]
}

function includeLibraryId(project: Project, id: string | null | undefined): boolean {
  if (!id) return false
  if (id.startsWith("sample-")) return false
  const templateIds = new Set(project.templateScreenshotIds ?? [])
  if (templateIds.has(id)) return false
  return true
}

/** Library ids that should appear in picker UI (no template placeholders). */
export function screenshotLibraryIdsForUi(project: Project): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of project.screenshotLibrary ?? []) {
    if (!includeLibraryId(project, id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Screenshot library ids — loaded lazily (not on initial editor hydrate). */
export function assetIdsFromScreenshotLibrary(project: Project): string[] {
  return screenshotLibraryIdsForUi(project)
}

/** Assets used only in non-active sizeLayouts (other phone models). */
export function assetIdsFromInactiveLayouts(project: Project): string[] {
  const active = new Set(assetIdsFromActiveLayout(project))
  const ids = new Set<string>()
  for (const [targetId, layout] of Object.entries(project.sizeLayouts ?? {})) {
    if (!layout) continue
    if (targetId === project.targetId) continue
    for (const slide of layout.slides) {
      collectSlideAssets(slide, ids)
    }
  }
  return [...ids].filter((id) => !active.has(id))
}

export function assetIdsFromProject(project: Project): string[] {
  const ids = new Set<string>()
  for (const slide of project.slides) {
    collectSlideAssets(slide, ids)
  }
  for (const layout of Object.values(project.sizeLayouts ?? {})) {
    if (!layout) continue
    for (const slide of layout.slides) {
      collectSlideAssets(slide, ids)
    }
  }
  for (const id of screenshotLibraryIdsForUi(project)) {
    ids.add(id)
  }
  return [...ids]
}
