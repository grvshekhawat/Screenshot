import { useEffect } from "react"
import { isModKey, isTypingTarget } from "./platform"
import { useProject } from "./project-store"

/** Platform-aware editor shortcuts: Undo / Redo / Delete. */
export function useEditorHotkeys() {
  const { undo, redo, deleteSelection, canvasFocused } = useProject()

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
  }, [undo, redo, deleteSelection, canvasFocused])
}
