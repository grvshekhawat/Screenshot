import { useEffect } from "react"
import { isModKey, isTypingTarget } from "./platform"
import {
  getPropertyClipboard,
  patchFromPropertyClipboard,
} from "./property-clipboard"
import { useProject } from "./project-store"
import { getSelectedIds } from "./selection"

/** Platform-aware editor shortcuts: Undo / Redo / Delete / Paste props. */
export function useEditorHotkeys() {
  const {
    undo,
    redo,
    deleteSelection,
    canvasFocused,
    patchSelectionCommon,
    selectedKind,
    activeSlide,
  } = useProject()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      const mod = isModKey(event)
      const key = event.key.toLowerCase()

      if (mod && key === "z" && !event.altKey) {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }

      // Windows / Linux redo
      if (mod && key === "y" && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        redo()
        return
      }

      // Paste copied property field/section onto the current selection
      if (mod && event.shiftKey && key === "v" && !event.altKey) {
        const entry = getPropertyClipboard()
        if (!entry || !selectedKind) return
        const ids = getSelectedIds(activeSlide)
        if (!ids.length) return
        const patch = patchFromPropertyClipboard(entry, selectedKind)
        if (Object.keys(patch).length === 0) return
        event.preventDefault()
        patchSelectionCommon(patch)
        return
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !mod &&
        !event.altKey
      ) {
        if (!canvasFocused) return
        event.preventDefault()
        deleteSelection()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    undo,
    redo,
    deleteSelection,
    canvasFocused,
    patchSelectionCommon,
    selectedKind,
    activeSlide,
  ])
}
