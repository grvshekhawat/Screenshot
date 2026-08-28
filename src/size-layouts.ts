import { STORE_TARGETS } from "./constants"
import { projectOrientation, storeTargetIdsForOrientation } from "./orientation"
import {
  adaptClipartToStoreTarget,
  adaptFrameToStoreTarget,
  adaptLensToStoreTarget,
  adaptProjectToStoreTarget,
  adaptTextToStoreTarget,
} from "./export-adapt"
import type {
  ClipartLayer,
  Frame,
  LensLayer,
  Project,
  SizeEditMode,
  SizeLayout,
  Slide,
  StoreTargetId,
  TextLayer,
} from "./types"

export const STORE_TARGET_IDS = Object.keys(STORE_TARGETS) as StoreTargetId[]

export function cloneSlides(slides: Slide[]): Slide[] {
  return structuredClone(slides)
}

export function layoutFromProject(project: Project): SizeLayout {
  return {
    slides: cloneSlides(project.slides),
    activeSlideId: project.activeSlideId,
  }
}

export function ensureSizeLayouts(project: Project): Project {
  const layouts: Partial<Record<StoreTargetId, SizeLayout>> = {
    ...(project.sizeLayouts ?? {}),
  }
  const designTargetId = project.designTargetId ?? project.targetId
  if (!layouts[project.targetId]) {
    layouts[project.targetId] = layoutFromProject(project)
  }
  if (!layouts[designTargetId]) {
    layouts[designTargetId] = layouts[project.targetId] ?? layoutFromProject(project)
  }
  return {
    ...project,
    designTargetId,
    sizeEditMode: project.sizeEditMode ?? "current",
    sizeLayouts: layouts,
  }
}

/** Persist the working slides into sizeLayouts[targetId]. */
export function saveCurrentLayout(project: Project): Project {
  const base = ensureSizeLayouts(project)
  return {
    ...base,
    sizeLayouts: {
      ...base.sizeLayouts,
      [base.targetId]: layoutFromProject(base),
    },
  }
}

function projectWithLayout(
  project: Project,
  targetId: StoreTargetId,
  layout: SizeLayout,
): Project {
  const slides = cloneSlides(layout.slides)
  const activeSlideId = slides.some((slide) => slide.id === layout.activeSlideId)
    ? layout.activeSlideId
    : (slides[0]?.id ?? project.activeSlideId)
  return {
    ...project,
    targetId,
    slides,
    activeSlideId,
    sizeLayouts: {
      ...project.sizeLayouts,
      [targetId]: { slides: cloneSlides(slides), activeSlideId },
    },
  }
}

type SelectedComponent =
  | { kind: "frame"; id: string; value: Frame }
  | { kind: "text"; id: string; value: TextLayer }
  | { kind: "clipart"; id: string; value: ClipartLayer }
  | { kind: "lens"; id: string; value: LensLayer }

function selectedComponentOnSlide(slide: Slide): SelectedComponent | null {
  const id = slide.selectedId
  if (!id) return null
  const frame = slide.frames.find((item) => item.id === id)
  if (frame) return { kind: "frame", id, value: frame }
  const text = slide.texts.find((item) => item.id === id)
  if (text) return { kind: "text", id, value: text }
  const clipart = slide.cliparts.find((item) => item.id === id)
  if (clipart) return { kind: "clipart", id, value: clipart }
  const lens = (slide.lenses ?? []).find((item) => item.id === id)
  if (lens) return { kind: "lens", id, value: lens }
  return null
}

function withLayerId(slide: Slide, id: string): Slide {
  if (slide.layerOrder.includes(id)) return slide
  return { ...slide, layerOrder: [...slide.layerOrder, id] }
}

function nearestFrame(lens: LensLayer, frames: Frame[]): Frame | null {
  if (!frames.length) return null
  let best = frames[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const frame of frames) {
    const dist =
      (frame.x - lens.x) * (frame.x - lens.x) +
      (frame.y - lens.y) * (frame.y - lens.y)
    if (dist < bestDist) {
      best = frame
      bestDist = dist
    }
  }
  return best
}

function adaptSelectedToTarget(
  selected: SelectedComponent,
  sourceSlide: Slide,
  targetSlide: Slide,
  fromTargetId: StoreTargetId,
  toTargetId: StoreTargetId,
): SelectedComponent {
  if (selected.kind === "frame") {
    return {
      ...selected,
      value: adaptFrameToStoreTarget(selected.value, fromTargetId, toTargetId),
    }
  }
  if (selected.kind === "text") {
    return {
      ...selected,
      value: adaptTextToStoreTarget(selected.value, fromTargetId, toTargetId),
    }
  }
  if (selected.kind === "clipart") {
    return {
      ...selected,
      value: adaptClipartToStoreTarget(
        selected.value,
        fromTargetId,
        toTargetId,
      ),
    }
  }
  const fromFrame = nearestFrame(selected.value, sourceSlide.frames)
  const toFrame = fromFrame
    ? (targetSlide.frames.find((frame) => frame.id === fromFrame.id) ??
      targetSlide.frames[0] ??
      null)
    : (targetSlide.frames[0] ?? null)
  return {
    ...selected,
    value: adaptLensToStoreTarget(
      selected.value,
      fromFrame,
      toFrame,
      fromTargetId,
      toTargetId,
    ),
  }
}

function applyComponentToSlide(
  slide: Slide,
  selected: SelectedComponent,
): Slide {
  if (selected.kind === "frame") {
    const exists = slide.frames.some((frame) => frame.id === selected.id)
    const frames = exists
      ? slide.frames.map((frame) =>
          frame.id === selected.id ? selected.value : frame,
        )
      : [...slide.frames, selected.value]
    return withLayerId({ ...slide, frames }, selected.id)
  }
  if (selected.kind === "text") {
    const exists = slide.texts.some((text) => text.id === selected.id)
    const texts = exists
      ? slide.texts.map((text) =>
          text.id === selected.id ? selected.value : text,
        )
      : [...slide.texts, selected.value]
    return withLayerId({ ...slide, texts }, selected.id)
  }
  if (selected.kind === "clipart") {
    const exists = slide.cliparts.some((clipart) => clipart.id === selected.id)
    const cliparts = exists
      ? slide.cliparts.map((clipart) =>
          clipart.id === selected.id ? selected.value : clipart,
        )
      : [...slide.cliparts, selected.value]
    return withLayerId({ ...slide, cliparts }, selected.id)
  }
  const lenses = slide.lenses ?? []
  const exists = lenses.some((lens) => lens.id === selected.id)
  const nextLenses = exists
    ? lenses.map((lens) => (lens.id === selected.id ? selected.value : lens))
    : [...lenses, selected.value]
  return withLayerId({ ...slide, lenses: nextLenses }, selected.id)
}

/**
 * Copy only the selected component onto the same slide in every other store size
 * (adapted for that size). Other layers on those sizes stay as-is.
 */
export function propagateSelectedComponentToAllSizes(
  project: Project,
): Project {
  const saved = saveCurrentLayout(project)
  const sourceSlide =
    saved.slides.find((slide) => slide.id === saved.activeSlideId) ??
    saved.slides[0]
  if (!sourceSlide) return saved

  const selected = selectedComponentOnSlide(sourceSlide)
  if (!selected) {
    return { ...saved, designTargetId: saved.targetId }
  }

  const fromId = saved.targetId
  const layouts: Partial<Record<StoreTargetId, SizeLayout>> = {
    ...saved.sizeLayouts,
    [fromId]: layoutFromProject(saved),
  }

  for (const targetId of storeTargetIdsForOrientation(
    projectOrientation(saved),
  )) {
    if (targetId === fromId) continue

    const layout = layouts[targetId]
    if (!layout?.slides.length) continue

    const slides = cloneSlides(layout.slides).map((slide) => {
      if (slide.id !== sourceSlide.id) return slide
      const adapted = adaptSelectedToTarget(
        selected,
        sourceSlide,
        slide,
        fromId,
        targetId,
      )
      return applyComponentToSlide(slide, adapted)
    })
    if (!slides.some((slide) => slide.id === sourceSlide.id)) continue

    layouts[targetId] = {
      slides,
      activeSlideId: layout.activeSlideId,
    }
  }

  return {
    ...saved,
    designTargetId: fromId,
    sizeLayouts: layouts,
  }
}

/**
 * Switch store size.
 * Always leaves edit mode as “this size” so each size is edited independently
 * after a switch (user can opt back into “all sizes”).
 * Loads that size’s saved layout, or creates one by adapting from the size left.
 */
export function switchProjectTarget(
  project: Project,
  nextTargetId: StoreTargetId,
): Project {
  const base =
    (project.sizeEditMode ?? "current") === "all"
      ? propagateSelectedComponentToAllSizes(project)
      : saveCurrentLayout(project)
  if (base.targetId === nextTargetId) {
    return { ...base, sizeEditMode: "current" }
  }

  const existing = base.sizeLayouts?.[nextTargetId]
  if (existing?.slides.length) {
    return {
      ...projectWithLayout(base, nextTargetId, existing),
      sizeEditMode: "current",
    }
  }

  const fromId = base.targetId
  const sourceLayout =
    base.sizeLayouts?.[fromId] ?? layoutFromProject(base)
  const sourceProject: Project = {
    ...base,
    targetId: fromId,
    designTargetId: fromId,
    slides: cloneSlides(sourceLayout.slides),
    activeSlideId: sourceLayout.activeSlideId,
  }
  const adapted = adaptProjectToStoreTarget(sourceProject, nextTargetId)
  return {
    ...projectWithLayout(base, nextTargetId, {
      slides: adapted.slides,
      activeSlideId: adapted.activeSlideId,
    }),
    sizeEditMode: "current",
  }
}

export function setProjectSizeEditMode(
  project: Project,
  mode: SizeEditMode,
): Project {
  const saved = saveCurrentLayout(project)

  if (mode === "all") {
    return {
      ...propagateSelectedComponentToAllSizes(saved),
      sizeEditMode: "all",
    }
  }

  if ((saved.sizeEditMode ?? "current") === "current") {
    return { ...saved, sizeEditMode: "current" }
  }

  return {
    ...saved,
    sizeEditMode: "current",
    designTargetId: saved.targetId,
  }
}

/** After an edit, keep sizeLayouts in sync (selected component when linked). */
export function syncLayoutsAfterEdit(project: Project): Project {
  if ((project.sizeEditMode ?? "current") === "all") {
    return {
      ...propagateSelectedComponentToAllSizes(project),
      sizeEditMode: "all",
    }
  }
  return saveCurrentLayout(project)
}

/** Project snapshot for exporting a specific store size. */
export function projectForExportTarget(
  project: Project,
  targetId: StoreTargetId,
): Project {
  const ensured = ensureSizeLayouts(project)
  const layout = ensured.sizeLayouts?.[targetId]

  if (layout?.slides.length) {
    return {
      ...ensured,
      targetId,
      designTargetId: targetId,
      slides: cloneSlides(layout.slides),
      activeSlideId: layout.activeSlideId,
    }
  }

  const fromId = ensured.designTargetId ?? ensured.targetId
  const sourceLayout = ensured.sizeLayouts?.[fromId] ?? layoutFromProject(ensured)
  const source: Project = {
    ...ensured,
    targetId: fromId,
    designTargetId: fromId,
    slides: cloneSlides(sourceLayout.slides),
    activeSlideId: sourceLayout.activeSlideId,
  }
  if (fromId === targetId) return { ...source, targetId }
  return adaptProjectToStoreTarget(source, targetId)
}
