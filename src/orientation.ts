import { STORE_TARGETS } from "./constants"
import type { Project, StoreTargetId } from "./types"

export type ArtboardOrientation = "portrait" | "landscape"

export function orientationOfTarget(
  targetId: StoreTargetId | string | null | undefined,
): ArtboardOrientation {
  if (targetId && targetId in STORE_TARGETS) {
    return STORE_TARGETS[targetId as StoreTargetId].orientation
  }
  return "portrait"
}

export function projectOrientation(project: Pick<Project, "targetId">): ArtboardOrientation {
  return orientationOfTarget(project.targetId)
}

export function storeTargetsForOrientation(
  orientation: ArtboardOrientation,
): (typeof STORE_TARGETS)[StoreTargetId][] {
  return Object.values(STORE_TARGETS).filter(
    (target) => target.orientation === orientation,
  )
}

export function storeTargetIdsForOrientation(
  orientation: ArtboardOrientation,
): StoreTargetId[] {
  return storeTargetsForOrientation(orientation).map((target) => target.id)
}

export function defaultTargetForOrientation(
  orientation: ArtboardOrientation,
): StoreTargetId {
  return orientation === "landscape" ? "iphone-69-landscape" : "iphone-69"
}
