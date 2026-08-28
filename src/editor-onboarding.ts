import type { Project } from "./types"

export type OnboardingStepId = "upload" | "template" | "export"

export type OnboardingProgress = {
  dismissed: boolean
  /** User applied a slide template at least once. */
  template: boolean
  /** User exported a PNG or ZIP at least once. */
  export: boolean
}

const STORAGE_KEY = "screenshot-studio:onboarding-v2"

const DEFAULT: OnboardingProgress = {
  dismissed: false,
  template: false,
  export: false,
}

export function loadOnboardingProgress(): OnboardingProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT }
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>
    return {
      dismissed: Boolean(parsed.dismissed),
      template: Boolean(parsed.template),
      export: Boolean(parsed.export),
    }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveOnboardingProgress(progress: OnboardingProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Ignore quota / private mode failures.
  }
}

/** True when any phone frame already has a screenshot (incl. size variants). */
export function projectHasScreenshot(project: Project): boolean {
  const slidesHaveShot = (slides: Project["slides"]) =>
    slides.some((slide) =>
      slide.frames.some(
        (frame) => Boolean(frame.screenshotId) || Boolean(frame.screenshotIdB),
      ),
    )

  if (slidesHaveShot(project.slides)) return true
  for (const layout of Object.values(project.sizeLayouts ?? {})) {
    if (layout?.slides && slidesHaveShot(layout.slides)) return true
  }
  return false
}

export const ONBOARDING_STEPS: {
  id: OnboardingStepId
  title: string
  detail: string
}[] = [
  {
    id: "upload",
    title: "Upload a screenshot",
    detail: "Drop your app screen onto a phone frame",
  },
  {
    id: "template",
    title: "Pick a template",
    detail: "Choose a layout under Slide Template",
  },
  {
    id: "export",
    title: "Export a preview",
    detail: "Download a PNG from the Export panel",
  },
]
