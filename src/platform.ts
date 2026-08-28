/** True on macOS / iOS (use ⌘); false on Windows / Linux (use Ctrl). */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false
  const platform = navigator.platform ?? ""
  const ua = navigator.userAgent ?? ""
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS|iPhone|iPad/i.test(ua)
}

/** Primary shortcut modifier: Meta on Apple, Ctrl elsewhere. */
export function isModKey(event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">): boolean {
  return isApplePlatform() ? event.metaKey : event.ctrlKey
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return Boolean(target.closest("[contenteditable='true']"))
}

export function modShortcutLabel(keys: string): string {
  const mod = isApplePlatform() ? "⌘" : "Ctrl"
  return `${mod}+${keys}`
}
