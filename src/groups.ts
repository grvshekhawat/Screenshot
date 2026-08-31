import type { LayerGroup, Slide } from "./types"

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

type SlideLayers = Pick<
  Slide,
  "frames" | "texts" | "cliparts" | "lenses" | "groups"
>

function layerIdsOnSlide(slide: SlideLayers): Set<string> {
  return new Set([
    ...slide.frames.map((frame) => frame.id),
    ...slide.texts.map((text) => text.id),
    ...slide.cliparts.map((clipart) => clipart.id),
    ...(slide.lenses ?? []).map((lens) => lens.id),
  ])
}

/** Drop invalid / undersized groups after edits or load. */
export function normalizeGroups(slide: SlideLayers): LayerGroup[] {
  const valid = layerIdsOnSlide(slide)
  const out: LayerGroup[] = []
  for (const group of slide.groups ?? []) {
    const memberIds = uniqueIds(group.memberIds).filter((id) => valid.has(id))
    if (memberIds.length < 2) continue
    out.push({
      id: group.id || crypto.randomUUID(),
      memberIds,
    })
  }
  return out
}

/** If any id belongs to a group, include all of that group's members. */
export function expandSelectionToGroups(
  slide: Slide,
  ids: string[],
): string[] {
  const groups = slide.groups ?? []
  const seen = new Set<string>()
  const out: string[] = []
  const add = (id: string) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    out.push(id)
  }
  for (const id of ids) {
    add(id)
    for (const group of groups) {
      if (!group.memberIds.includes(id)) continue
      for (const memberId of group.memberIds) add(memberId)
    }
  }
  return out
}

export function selectionMatchesExactGroup(
  slide: Slide,
  ids: string[],
): boolean {
  const set = new Set(uniqueIds(ids))
  if (set.size < 2) return false
  return (slide.groups ?? []).some(
    (group) =>
      group.memberIds.length === set.size &&
      group.memberIds.every((id) => set.has(id)),
  )
}

export function selectionIntersectsGroup(
  slide: Slide,
  ids: string[],
): boolean {
  const set = new Set(ids)
  return (slide.groups ?? []).some((group) =>
    group.memberIds.some((id) => set.has(id)),
  )
}

export function canGroupSelection(slide: Slide, ids: string[]): boolean {
  const members = uniqueIds(ids).filter((id) => layerIdsOnSlide(slide).has(id))
  return members.length >= 2 && !selectionMatchesExactGroup(slide, members)
}

export function canUngroupSelection(slide: Slide, ids: string[]): boolean {
  return selectionIntersectsGroup(slide, ids)
}

/** Create a group from ids; dissolve any overlapping groups. */
export function applyGroupSelection(
  slide: Slide,
  ids: string[],
  primaryId?: string,
): Slide {
  const valid = layerIdsOnSlide(slide)
  const members = uniqueIds(ids).filter((id) => valid.has(id))
  if (members.length < 2) return slide
  const memberSet = new Set(members)
  const remaining = (slide.groups ?? []).filter(
    (group) => !group.memberIds.some((id) => memberSet.has(id)),
  )
  const group: LayerGroup = {
    id: crypto.randomUUID(),
    memberIds: members,
  }
  const selectedId =
    primaryId && members.includes(primaryId)
      ? primaryId
      : members[members.length - 1]!
  return {
    ...slide,
    groups: [...remaining, group],
    selectedId,
    selectedIds: members,
  }
}

/** Remove every group that intersects the given ids. */
export function applyUngroupSelection(slide: Slide, ids: string[]): Slide {
  const set = new Set(ids)
  return {
    ...slide,
    groups: (slide.groups ?? []).filter(
      (group) => !group.memberIds.some((id) => set.has(id)),
    ),
  }
}
