import type { SelectedKind } from "./types"
import {
  filterPastePatch,
  type PropertySectionId,
  type SelectionPatch,
} from "./selection"

export type { PropertySectionId }

export type PropertyClipboard =
  | {
      scope: "field"
      key: keyof SelectionPatch
      value: SelectionPatch[keyof SelectionPatch]
      sourceKind: SelectedKind
      label: string
    }
  | {
      scope: "section"
      section: PropertySectionId
      patch: SelectionPatch
      sourceKind: SelectedKind
      label: string
    }

type Listener = () => void

let clipboard: PropertyClipboard | null = null
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function getPropertyClipboard(): PropertyClipboard | null {
  return clipboard
}

export function setPropertyClipboard(next: PropertyClipboard | null) {
  clipboard = next
  emit()
}

export function clearPropertyClipboard() {
  setPropertyClipboard(null)
}

export function subscribePropertyClipboard(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function propertyClipboardSummary(
  entry: PropertyClipboard | null = clipboard,
): string {
  if (!entry) return ""
  return entry.scope === "field"
    ? `Copied ${entry.label}`
    : `Copied ${entry.label} section`
}

/** Resolve clipboard contents into a patch safe for the target kind. */
export function patchFromPropertyClipboard(
  entry: PropertyClipboard,
  targetKind: SelectedKind,
): SelectionPatch {
  const raw: SelectionPatch =
    entry.scope === "field"
      ? ({ [entry.key]: entry.value } as SelectionPatch)
      : entry.patch
  return filterPastePatch(raw, entry.sourceKind, targetKind)
}
