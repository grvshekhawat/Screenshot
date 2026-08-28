import { useEffect, useRef, useState } from "react"
import { useAuth } from "../auth/AuthProvider"
import { startCheckout } from "../billing/checkout"
import { PaywallModal } from "../billing/PaywallModal"
import { storeTargetsForOrientation, projectOrientation } from "../orientation"
import {
  loadOnboardingProgress,
  projectHasScreenshot,
  saveOnboardingProgress,
  type OnboardingProgress,
  type OnboardingStepId,
} from "../editor-onboarding"
import { downloadProjectZip, downloadSlidePng } from "../export"
import { IMAGE_ACCEPT, isImageFile } from "../image-upload"
import { modShortcutLabel } from "../platform"
import { useProject } from "../project-store"
import type { FrameScreenSlot } from "../types"
import { useEditorHotkeys } from "../useEditorHotkeys"
import { DesignCanvas } from "./DesignCanvas"
import { EditorOnboarding } from "./EditorOnboarding"
import { Inspector, type MenuId } from "./Inspector"

type UploadMode = "screenshot" | "clipart" | "background"

export function Editor() {
  const { canExport, userId, refreshProfile } = useAuth()
  const {
    ready,
    project,
    activeSlide,
    activeFrame,
    assetUrls,
    saveState,
    lastSavedAt,
    setName,
    setTarget,
    setSizeEditMode,
    canvasFocused,
    attachScreenshot,
    attachClipart,
    attachBackgroundImage,
    saveDraft,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProject()
  useEditorHotkeys()
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadMode = useRef<UploadMode>("screenshot")
  const uploadFrameId = useRef<string | undefined>(undefined)
  const uploadSlideId = useRef<string | undefined>(undefined)
  const uploadSlot = useRef<FrameScreenSlot>("a")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallBusy, setPaywallBusy] = useState(false)
  const [paywallError, setPaywallError] = useState<string | null>(null)
  const [toolMenu, setToolMenu] = useState<MenuId | null>("content")
  const [onboarding, setOnboarding] = useState<OnboardingProgress>(() =>
    loadOnboardingProgress(),
  )

  const hasComponentSelection = Boolean(
    canvasFocused && activeSlide.selectedId,
  )

  const markOnboarding = (patch: Partial<OnboardingProgress>) => {
    setOnboarding((current) => {
      const next = { ...current, ...patch }
      saveOnboardingProgress(next)
      return next
    })
  }

  const uploadDone = projectHasScreenshot(project)
  const onboardingCompleted = {
    upload: uploadDone,
    template: onboarding.template,
    export: onboarding.export,
  }
  const onboardingAllDone =
    onboardingCompleted.upload &&
    onboardingCompleted.template &&
    onboardingCompleted.export

  // Hide for good once every step is done (no need to click Got it).
  useEffect(() => {
    if (onboarding.dismissed || !onboardingAllDone) return
    markOnboarding({ dismissed: true })
  }, [onboarding.dismissed, onboardingAllDone])

  const showOnboarding = ready && !onboarding.dismissed && !onboardingAllDone

  const openUpload = (
    frameId?: string,
    slideId?: string,
    slot?: FrameScreenSlot,
  ) => {
    uploadMode.current = "screenshot"
    uploadSlideId.current = slideId ?? activeSlide.id
    uploadFrameId.current = frameId ?? activeFrame?.id
    uploadSlot.current = slot ?? "a"
    fileRef.current?.click()
  }

  const handleOnboardingStep = (step: OnboardingStepId) => {
    if (step === "upload") {
      setToolMenu("content")
      openUpload(activeFrame?.id, activeSlide.id, "a")
      return
    }
    if (step === "template") {
      setToolMenu("template")
      return
    }
    setToolMenu("export")
  }

  const openClipartUpload = (slideId?: string) => {
    uploadMode.current = "clipart"
    uploadSlideId.current = slideId ?? activeSlide.id
    fileRef.current?.click()
  }

  const openBackgroundUpload = (slideId?: string) => {
    uploadMode.current = "background"
    uploadSlideId.current = slideId ?? activeSlide.id
    fileRef.current?.click()
  }

  const onFiles = (
    files: FileList | File[],
    slideId?: string,
    frameId?: string,
    slot?: FrameScreenSlot,
  ) => {
    const file = [...files].find((item) => isImageFile(item))
    if (!file) return
    const targetSlideId = slideId ?? uploadSlideId.current ?? activeSlide.id
    const fromDrop =
      slideId !== undefined || frameId !== undefined || slot !== undefined
    const run = async () => {
      setError(null)
      try {
        if (!fromDrop && uploadMode.current === "clipart") {
          await attachClipart(targetSlideId, file)
          return
        }
        if (!fromDrop && uploadMode.current === "background") {
          await attachBackgroundImage(targetSlideId, file)
          return
        }
        const targetFrameId =
          frameId ?? uploadFrameId.current ?? activeFrame?.id
        let nextSlot: FrameScreenSlot = slot ?? uploadSlot.current ?? "a"
        // Drop onto a split frame with A filled and B empty → fill B
        if (frameId && slot === undefined) {
          const slide =
            project.slides.find((item) => item.id === targetSlideId) ??
            activeSlide
          const frame = slide.frames.find((item) => item.id === frameId)
          if (
            frame?.screenMode === "split" &&
            frame.screenshotId &&
            !frame.screenshotIdB
          ) {
            nextSlot = "b"
          } else if (!slot) {
            nextSlot = "a"
          }
        }
        await attachScreenshot(targetSlideId, file, targetFrameId, nextSlot)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed")
      }
    }
    void run()
  }

  const requireExportAccess = () => {
    if (canExport) return true
    setPaywallOpen(true)
    return false
  }

  const exportPng = async () => {
    setError(null)
    setBusy(canExport ? "Rendering PNG…" : "Rendering preview…")
    try {
      const index = project.slides.findIndex(
        (slide) => slide.id === activeSlide.id,
      )
      await downloadSlidePng(
        activeSlide,
        project.targetId,
        assetUrls,
        index,
        project,
        { watermark: !canExport },
      )
      markOnboarding({ export: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setBusy(null)
    }
  }

  const exportZip = async (allSizes = false) => {
    if (!requireExportAccess()) return
    setError(null)
    setBusy(allSizes ? "Exporting all sizes…" : "Exporting ZIP…")
    try {
      await downloadProjectZip(project, assetUrls, setBusy, { allSizes })
      markOnboarding({ export: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setBusy(null)
    }
  }

  const onPaywallChoose = async (provider: "stripe" | "paypal") => {
    if (!userId) return
    setPaywallBusy(true)
    setPaywallError(null)
    try {
      const result = await startCheckout(provider, userId)
      await refreshProfile()
      if (result.url) {
        window.location.href = result.url
        return
      }
      setPaywallOpen(false)
    } catch (err) {
      setPaywallError(err instanceof Error ? err.message : "Checkout failed")
    } finally {
      setPaywallBusy(false)
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Draft saved"
        : "Unsaved"

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Loading project…
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold">
            SS
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Screenshot Studio
          </span>
        </div>
        <input
          value={project.name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-200 outline-none hover:border-zinc-800 focus:border-zinc-700"
        />
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-[11px] text-zinc-500">{saveLabel}</span>
          {lastSavedAt ? (
            <span className="text-[11px] text-zinc-600">
              {new Date(lastSavedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
          {!canExport ? (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              Free · watermarked PNG
            </span>
          ) : (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
              Pro
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={`Undo (${modShortcutLabel("Z")})`}
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => undo()}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 disabled:opacity-35"
          >
            Undo
          </button>
          <button
            type="button"
            title={`Redo (${modShortcutLabel("Shift+Z")})`}
            aria-label="Redo"
            disabled={!canRedo}
            onClick={() => redo()}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 disabled:opacity-35"
          >
            Redo
          </button>
        </div>
        <button
          type="button"
          disabled={saveState === "saving"}
          onClick={() => void saveDraft()}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
        >
          Save draft
        </button>
        <select
          value={project.targetId}
          onChange={(event) =>
            setTarget(event.target.value as typeof project.targetId)
          }
          className="max-w-[240px] rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
        >
          {storeTargetsForOrientation(projectOrientation(project)).map(
            (target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ),
          )}
        </select>
        <div
          className="flex rounded-md border border-zinc-800 p-0.5"
          role="group"
          aria-label="Size edit mode"
        >
          <button
            type="button"
            title="Edits apply only to the selected store size"
            onClick={() => setSizeEditMode("current")}
            className={`rounded px-2 py-1 text-xs ${
              (project.sizeEditMode ?? "current") === "current"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            This size
          </button>
          <button
            type="button"
            title={
              hasComponentSelection
                ? "Apply the selected component to every store size"
                : "Select a component first"
            }
            disabled={!hasComponentSelection && project.sizeEditMode !== "all"}
            onClick={() => setSizeEditMode("all")}
            className={`rounded px-2 py-1 text-xs disabled:opacity-40 ${
              project.sizeEditMode === "all"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All sizes
          </button>
        </div>
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </header>
      <div className="flex min-h-0 flex-1">
        <Inspector
          onUploadClick={openUpload}
          onClipartUploadClick={openClipartUpload}
          onBackgroundUploadClick={openBackgroundUpload}
          onScreenshotFiles={onFiles}
          assetUrls={assetUrls}
          onExportPng={() => void exportPng()}
          onExportZip={() => void exportZip(false)}
          onExportAllSizesZip={() => void exportZip(true)}
          canExportClean={canExport}
          busy={busy}
          menu={toolMenu}
          onMenuChange={setToolMenu}
          onTemplatePicked={() => markOnboarding({ template: true })}
        >
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <DesignCanvas onUploadClick={openUpload} onFiles={onFiles} />
            {showOnboarding ? (
              <EditorOnboarding
                completed={onboardingCompleted}
                onStepClick={handleOnboardingStep}
                onDismiss={() => markOnboarding({ dismissed: true })}
              />
            ) : null}
          </div>
        </Inspector>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          if (event.target.files) onFiles(event.target.files)
          event.target.value = ""
        }}
      />
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onChoose={(provider) => void onPaywallChoose(provider)}
        busy={paywallBusy}
        error={paywallError}
      />
    </div>
  )
}
