import { isVideoStoreTarget, STORE_TARGETS } from "./constants"
import type { Project, ProjectKind, StoreTargetId } from "./types"

export type ArtboardOrientation = "portrait" | "landscape"

/** Projects list filter: screenshot orientations + video workspace. */
export type ProjectsFilter = ArtboardOrientation | "video"

export function orientationOfTarget(
  targetId: StoreTargetId | string | null | undefined,
): ArtboardOrientation {
  if (targetId && targetId in STORE_TARGETS) {
    return STORE_TARGETS[targetId as StoreTargetId].orientation
  }
  return "portrait"
}

export function projectKindOf(
  project: Pick<Project, "projectKind" | "targetId">,
): ProjectKind {
  if (project.projectKind === "video" || isVideoStoreTarget(project.targetId)) {
    return "video"
  }
  return "screenshots"
}

export function projectOrientation(
  project: Pick<Project, "targetId" | "projectKind">,
): ArtboardOrientation {
  if (projectKindOf(project) === "video") return "portrait"
  return orientationOfTarget(project.targetId)
}

/** Whether a project belongs on the given Projects page filter. */
export function projectMatchesFilter(
  project: Pick<Project, "targetId" | "projectKind">,
  filter: ProjectsFilter,
): boolean {
  const kind = projectKindOf(project)
  if (filter === "video") return kind === "video"
  return kind === "screenshots" && projectOrientation(project) === filter
}

export function storeTargetsForOrientation(
  orientation: ArtboardOrientation,
  kind: ProjectKind = "screenshots",
): (typeof STORE_TARGETS)[StoreTargetId][] {
  return Object.values(STORE_TARGETS).filter((target) => {
    const isVideo = isVideoStoreTarget(target.id)
    if (kind === "video") return isVideo
    return !isVideo && target.orientation === orientation
  })
}

export function storeTargetIdsForOrientation(
  orientation: ArtboardOrientation,
  kind: ProjectKind = "screenshots",
): StoreTargetId[] {
  return storeTargetsForOrientation(orientation, kind).map((target) => target.id)
}

export function defaultTargetForOrientation(
  orientation: ArtboardOrientation,
): StoreTargetId {
  return orientation === "landscape" ? "iphone-69-landscape" : "iphone-69"
}
