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
  return [...ids]
}
