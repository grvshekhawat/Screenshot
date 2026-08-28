import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { assetIdsFromProject } from "./assets"
import {
  setProjectSizeEditMode,
  switchProjectTarget,
  syncLayoutsAfterEdit,
} from "./size-layouts"
import {
  applyTemplate,
  appendLayerOrder,
  createClipart,
  createFrame,
  createLens,
  createSampleProject,
  createSlide,
  createText,
  defaultBackground,
  getActiveClipart,
  getActiveFrame,
  getActiveLens,
  getActiveText,
  MAX_CLIPARTS,
  MAX_FRAMES,
  MAX_LENSES,
  MAX_TEXTS,
  moveInLayerOrder,
  normalizeLayerOrder,
  normalizeProject,
  probeImageAspect,
  sanitizeSlideSelection,
  selectedKind,
  STORE_TARGETS,
} from "./constants"
import {
  getProject,
  listPublishedCliparts,
  resolveAssetUrl,
  saveProjectRecord,
  uploadProjectAsset,
} from "./api/projects"
import { captureSlideSnapshot } from "./export"
import {
  loadProject,
  loadScreenshot,
  saveProject,
  saveScreenshot,
} from "./storage"
import type {
  ClipartLayer,
  Frame,
  FrameScreenSlot,
  LensLayer,
  Project,
  Slide,
  StoreTargetId,
  SizeEditMode,
  TemplateId,
  TextLayer,
  SelectedKind,
  ThumbnailLayout,
} from "./types"
import {
  clipartContinuitySlidePadding,
  continuitySlidePadding,
  type OverflowEdges,
} from "./overflow"

type SaveState = "saved" | "saving" | "unsaved"

type ProjectContextValue = {
  ready: boolean
  projectId: string | null
  project: Project
  /** Layout remapped to `targetId` for canvas preview / WYSIWYG export. */
  viewProject: Project
  assetUrls: Record<string, string>
  libraryCliparts: { id: string; name: string; category: string; url: string }[]
  saveState: SaveState
  lastSavedAt: number | null
  activeSlide: Slide
  activeFrame: Frame | null
  activeText: TextLayer | null
  activeClipart: ClipartLayer | null
  activeLens: LensLayer | null
  selectedKind: SelectedKind
  /** False after clicking empty canvas; true when a slide or component is selected. */
  canvasFocused: boolean
  setName: (name: string) => void
  setTarget: (targetId: StoreTargetId) => void
  setSizeEditMode: (mode: SizeEditMode) => void
  setThumbnailLayout: (layout: ThumbnailLayout) => void
  selectSlide: (id: string) => void
  clearSelection: () => void
  addSlide: () => void
  insertSlideAt: (index: number) => void
  setFrameOverflow: (
    slideId: string,
    frameId: string,
    mode: Frame["overflow"],
    edges: OverflowEdges,
  ) => void
  setClipartOverflow: (
    slideId: string,
    clipartId: string,
    mode: ClipartLayer["overflow"],
    edges: OverflowEdges,
  ) => void
  duplicateSlide: (id: string) => void
  deleteSlide: (id: string) => void
  updateSlide: (id: string, patch: Partial<Slide>) => void
  applySlideTemplate: (id: string, templateId: TemplateId) => void
  reorderSlides: (from: number, to: number) => void
  selectFrame: (slideId: string, frameId: string) => void
  selectText: (slideId: string, textId: string) => void
  selectClipart: (slideId: string, clipartId: string) => void
  selectLens: (slideId: string, lensId: string) => void
  addFrame: (slideId: string) => void
  duplicateFrame: (slideId: string, frameId: string) => void
  removeFrame: (slideId: string, frameId: string) => void
  updateFrame: (slideId: string, frameId: string, patch: Partial<Frame>) => void
  moveFrame: (slideId: string, frameId: string, direction: "forward" | "back") => void
  addText: (slideId: string) => void
  duplicateText: (slideId: string, textId: string) => void
  removeText: (slideId: string, textId: string) => void
  updateText: (slideId: string, textId: string, patch: Partial<TextLayer>) => void
  moveText: (slideId: string, textId: string, direction: "forward" | "back") => void
  addClipart: (slideId: string, assetId: string, aspect?: number) => void
  addLibraryClipart: (slideId: string, libraryId: string, url: string) => void
  duplicateClipart: (slideId: string, clipartId: string) => void
  removeClipart: (slideId: string, clipartId: string) => void
  updateClipart: (
    slideId: string,
    clipartId: string,
    patch: Partial<ClipartLayer>,
  ) => void
  moveClipart: (
    slideId: string,
    clipartId: string,
    direction: "forward" | "back",
  ) => void
  addLens: (slideId: string) => void
  duplicateLens: (slideId: string, lensId: string) => void
  removeLens: (slideId: string, lensId: string) => void
  updateLens: (slideId: string, lensId: string, patch: Partial<LensLayer>) => void
  lockLensImage: (slideId: string, lensId: string) => Promise<void>
  moveLens: (
    slideId: string,
    lensId: string,
    direction: "forward" | "back",
  ) => void
  /** Copy frame/text/clipart onto another slide; selects the target slide. */
  copyComponentToSlide: (
    sourceSlideId: string,
    componentId: string,
    targetSlideId: string,
  ) => void
  attachScreenshot: (
    slideId: string,
    file: File,
    frameId?: string,
    slot?: FrameScreenSlot,
  ) => Promise<void>
  attachClipart: (slideId: string, file: File) => Promise<void>
  attachBackgroundImage: (slideId: string, file: File) => Promise<void>
  saveDraft: () => Promise<void>
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  deleteSelection: () => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

function copyBackground(background: Slide["background"]): Slide["background"] {
  return defaultBackground({
    type: background.type,
    colors: [...background.colors],
    angle: background.angle,
    imageId: background.imageId,
    imageFit: background.imageFit,
    imageOpacity: background.imageOpacity,
  })
}

function ensureContinuitySlidesForFrame(
  slides: Slide[],
  ownerSlideId: string,
  frame: Frame,
  targetId: StoreTargetId,
  templateSlide: Slide,
): Slide[] {
  const { width, height } = STORE_TARGETS[targetId]
  const makeNeighbor = () =>
    createSlide({
      frames: [],
      texts: [],
      background: copyBackground(templateSlide.background),
      templateId: templateSlide.templateId,
    })

  let result = slides
  let ownerIndex = result.findIndex((slide) => slide.id === ownerSlideId)
  if (ownerIndex < 0) return result

  for (let guard = 0; guard < 8; guard++) {
    const { prepend, append } = continuitySlidePadding(
      frame,
      ownerIndex,
      result.length,
      width,
      height,
    )
    if (prepend === 0 && append === 0) break
    if (prepend > 0) {
      result = [
        ...Array.from({ length: prepend }, makeNeighbor),
        ...result,
      ]
      ownerIndex += prepend
    }
    if (append > 0) {
      result = [...result, ...Array.from({ length: append }, makeNeighbor)]
    }
  }
  return result
}

function ensureContinuitySlidesForClipart(
  slides: Slide[],
  ownerSlideId: string,
  clipart: ClipartLayer,
  targetId: StoreTargetId,
  templateSlide: Slide,
): Slide[] {
  const { width, height } = STORE_TARGETS[targetId]
  const makeNeighbor = () =>
    createSlide({
      frames: [],
      texts: [],
      background: copyBackground(templateSlide.background),
      templateId: templateSlide.templateId,
    })

  let result = slides
  let ownerIndex = result.findIndex((slide) => slide.id === ownerSlideId)
  if (ownerIndex < 0) return result

  for (let guard = 0; guard < 8; guard++) {
    const { prepend, append } = clipartContinuitySlidePadding(
      clipart,
      ownerIndex,
      result.length,
      width,
      height,
    )
    if (prepend === 0 && append === 0) break
    if (prepend > 0) {
      result = [
        ...Array.from({ length: prepend }, makeNeighbor),
        ...result,
      ]
      ownerIndex += prepend
    }
    if (append > 0) {
      result = [...result, ...Array.from({ length: append }, makeNeighbor)]
    }
  }
  return result
}

export function ProjectProvider({
  children,
  projectId = null,
}: {
  children: ReactNode
  projectId?: string | null
}) {
  const [ready, setReady] = useState(false)
  const [project, setProjectState] = useState<Project>(createSampleProject)
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [libraryCliparts, setLibraryCliparts] = useState<
    { id: string; name: string; category: string; url: string }[]
  >([])
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [canvasFocused, setCanvasFocused] = useState(true)
  const [historyTick, setHistoryTick] = useState(0)
  const historyPastRef = useRef<Project[]>([])
  const historyFutureRef = useRef<Project[]>([])
  const historyCoalesceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectRef = useRef(project)
  const assetUrlsRef = useRef(assetUrls)
  projectRef.current = project
  assetUrlsRef.current = assetUrls

  const clearHistoryCoalesce = useCallback(() => {
    if (historyCoalesceRef.current) {
      clearTimeout(historyCoalesceRef.current)
      historyCoalesceRef.current = null
    }
  }, [])

  const resetHistory = useCallback(() => {
    clearHistoryCoalesce()
    historyPastRef.current = []
    historyFutureRef.current = []
    setHistoryTick((tick) => tick + 1)
  }, [clearHistoryCoalesce])

  /** Undoable project edits (coalesces rapid updates like drag/slider). */
  const setProject = useCallback(
    (updater: Project | ((current: Project) => Project)) => {
      setProjectState((current) => {
        if (historyCoalesceRef.current === null) {
          historyPastRef.current.push(structuredClone(current))
          if (historyPastRef.current.length > 40) {
            historyPastRef.current.shift()
          }
          historyFutureRef.current = []
          setHistoryTick((tick) => tick + 1)
        } else {
          clearTimeout(historyCoalesceRef.current)
        }
        historyCoalesceRef.current = setTimeout(() => {
          historyCoalesceRef.current = null
        }, 450)
        const next = typeof updater === "function" ? updater(current) : updater
        const synced = syncLayoutsAfterEdit(next)
        projectRef.current = synced
        return synced
      })
    },
    [],
  )

  const undo = useCallback(() => {
    clearHistoryCoalesce()
    setProjectState((current) => {
      const previous = historyPastRef.current.pop()
      if (!previous) return current
      historyFutureRef.current.push(structuredClone(current))
      setHistoryTick((tick) => tick + 1)
      return previous
    })
  }, [clearHistoryCoalesce])

  const redo = useCallback(() => {
    clearHistoryCoalesce()
    setProjectState((current) => {
      const next = historyFutureRef.current.pop()
      if (!next) return current
      historyPastRef.current.push(structuredClone(current))
      setHistoryTick((tick) => tick + 1)
      return next
    })
  }, [clearHistoryCoalesce])

  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      setReady(false)
      const urls: Record<string, string> = {}
      let loaded: Project

      if (projectId) {
        const record = await getProject(projectId)
        if (!record) throw new Error("Project not found")
        loaded = record.data
        await Promise.all(
          assetIdsFromProject(loaded).map(async (id) => {
            const url = await resolveAssetUrl(id)
            if (url) urls[id] = url
            else {
              const blob = await loadScreenshot(id)
              if (blob) urls[id] = URL.createObjectURL(blob)
            }
          }),
        )
      } else {
        loaded = await loadProject()
        await Promise.all(
          assetIdsFromProject(loaded).map(async (id) => {
            const url = await resolveAssetUrl(id)
            if (url) {
              urls[id] = url
              return
            }
            const blob = await loadScreenshot(id)
            if (blob) urls[id] = URL.createObjectURL(blob)
          }),
        )
      }

      const library = await listPublishedCliparts().catch(() => [])
      for (const item of library) {
        if (item.url) urls[`library:${item.id}`] = item.url
      }
      if (cancelled) {
        for (const url of Object.values(urls)) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url)
        }
        return
      }
      setProjectState(normalizeProject(loaded))
      resetHistory()
      setAssetUrls(urls)
      setLibraryCliparts(
        library
          .filter((item) => item.url)
          .map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            url: item.url!,
          })),
      )
      setLastSavedAt(Date.now())
      setSaveState("saved")
      setReady(true)
    }
    void hydrate().catch(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [projectId, resetHistory])

  useEffect(() => {
    if (!ready) return
    setSaveState("unsaved")
    const timer = window.setTimeout(() => {
      void (async () => {
        setSaveState("saving")
        if (projectId) await saveProjectRecord(projectId, project)
        else await saveProject(project)
        setSaveState("saved")
        setLastSavedAt(Date.now())
      })()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [project, ready, projectId])

  const storeAsset = useCallback(async (file: File) => {
    const { normalizeImageFile } = await import("./image-upload")
    const normalized = await normalizeImageFile(file)
    const id = crypto.randomUUID()
    // Always persist locally so reload can restore assets even if cloud upload fails.
    await saveScreenshot(id, normalized)
    if (projectId) {
      const localPreview = URL.createObjectURL(normalized)
      setAssetUrls((current) => ({ ...current, [id]: localPreview }))
      try {
        const url = await uploadProjectAsset(id, normalized)
        setAssetUrls((current) => ({ ...current, [id]: url }))
        if (url !== localPreview) URL.revokeObjectURL(localPreview)
      } catch (err) {
        // IndexedDB copy above keeps the asset available after reload
        console.error(err)
      }
    } else {
      const url = URL.createObjectURL(normalized)
      setAssetUrls((current) => ({ ...current, [id]: url }))
    }
    return { id, file: normalized }
  }, [projectId])

  const saveDraft = useCallback(async () => {
    setSaveState("saving")
    if (projectId) await saveProjectRecord(projectId, project)
    else await saveProject(project)
    setSaveState("saved")
    setLastSavedAt(Date.now())
  }, [project, projectId])

  const setName = useCallback((name: string) => {
    setProject((current) => ({ ...current, name }))
  }, [])

  const setTarget = useCallback((targetId: StoreTargetId) => {
    setProject((current) => {
      const from = STORE_TARGETS[current.targetId]?.orientation
      const to = STORE_TARGETS[targetId]?.orientation
      // Orientation is fixed per project — only switch sizes within the same orientation.
      if (from && to && from !== to) return current
      return switchProjectTarget(current, targetId)
    })
  }, [setProject])

  const setSizeEditMode = useCallback((mode: SizeEditMode) => {
    setProject((current) => setProjectSizeEditMode(current, mode))
  }, [setProject])

  const setThumbnailLayout = useCallback((layout: ThumbnailLayout) => {
    setProject((current) => ({ ...current, thumbnailLayout: layout }))
  }, [setProject])

  const selectSlide = useCallback((id: string) => {
    setCanvasFocused(true)
    setProjectState((current) => ({ ...current, activeSlideId: id }))
  }, [])

  const clearSelection = useCallback(() => {
    setCanvasFocused(false)
    setProjectState((current) => ({
      ...current,
      slides: current.slides.map((slide) => ({ ...slide, selectedId: "" })),
    }))
  }, [])

  const addSlide = useCallback(() => {
    setProject((current) => {
      const active =
        current.slides.find((slide) => slide.id === current.activeSlideId) ??
        current.slides[0]
      const frames = active.frames.map((frame) =>
        createFrame({
          deviceId: frame.deviceId,
          x: frame.x,
          y: frame.y,
          scale: frame.scale,
          rotation: frame.rotation,
          rotationX: frame.rotationX,
          rotationY: frame.rotationY,
          screenshotId: null,
        }),
      )
      const texts = active.texts.map((text) =>
        createText({ ...text, id: crypto.randomUUID() }),
      )
      const cliparts = active.cliparts.map((clipart) =>
        createClipart({ ...clipart, id: crypto.randomUUID() }),
      )
      const next = createSlide({
        frames,
        texts,
        cliparts,
        background: copyBackground(active.background),
        templateId: active.templateId,
      })
      return {
        ...current,
        slides: [...current.slides, next],
        activeSlideId: next.id,
      }
    })
  }, [])

  const insertSlideAt = useCallback((index: number) => {
    setProject((current) => {
      const at = Math.max(0, Math.min(index, current.slides.length))
      // Style from the slide on the left of the insertion point when possible
      const source =
        current.slides[Math.max(0, at - 1)] ??
        current.slides[0]
      if (!source) return current
      const next = createSlide({
        background: copyBackground(source.background),
        templateId: source.templateId,
        texts: source.texts.map((text) =>
          createText({ ...text, id: crypto.randomUUID() }),
        ),
      })
      const slides = [...current.slides]
      slides.splice(at, 0, next)
      return { ...current, slides, activeSlideId: next.id }
    })
  }, [])

  const setFrameOverflow = useCallback(
    (
      slideId: string,
      frameId: string,
      mode: Frame["overflow"],
      _edges: OverflowEdges,
    ) => {
      setProject((current) => {
        let slides = current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            frames: slide.frames.map((frame) =>
              frame.id === frameId ? { ...frame, overflow: mode } : frame,
            ),
          }
        })
        if (mode !== "continue") return { ...current, slides }

        const source = slides.find((slide) => slide.id === slideId)
        if (!source) return { ...current, slides }

        const frame = source.frames.find((item) => item.id === frameId)
        if (!frame) return { ...current, slides }

        slides = ensureContinuitySlidesForFrame(
          slides,
          slideId,
          { ...frame, overflow: "continue" },
          current.targetId,
          source,
        )
        return { ...current, slides }
      })
    },
    [],
  )

  const setClipartOverflow = useCallback(
    (
      slideId: string,
      clipartId: string,
      mode: ClipartLayer["overflow"],
      _edges: OverflowEdges,
    ) => {
      setProject((current) => {
        let slides = current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            cliparts: slide.cliparts.map((clipart) =>
              clipart.id === clipartId ? { ...clipart, overflow: mode } : clipart,
            ),
          }
        })
        if (mode !== "continue") return { ...current, slides }

        const source = slides.find((slide) => slide.id === slideId)
        if (!source) return { ...current, slides }

        const clipart = source.cliparts.find((item) => item.id === clipartId)
        if (!clipart) return { ...current, slides }

        slides = ensureContinuitySlidesForClipart(
          slides,
          slideId,
          { ...clipart, overflow: "continue" },
          current.targetId,
          source,
        )
        return { ...current, slides }
      })
    },
    [],
  )

  const duplicateSlide = useCallback((id: string) => {
    setProject((current) => {
      const index = current.slides.findIndex((slide) => slide.id === id)
      if (index < 0) return current
      const source = current.slides[index]
      const frames = source.frames.map((frame) =>
        createFrame({ ...frame, id: crypto.randomUUID() }),
      )
      const texts = source.texts.map((text) =>
        createText({ ...text, id: crypto.randomUUID() }),
      )
      const cliparts = source.cliparts.map((clipart) =>
        createClipart({ ...clipart, id: crypto.randomUUID() }),
      )
      const lenses = (source.lenses ?? []).map((lens) =>
        createLens({ ...lens, id: crypto.randomUUID() }),
      )
      const idMap = new Map<string, string>()
      source.frames.forEach((frame, frameIndex) => {
        idMap.set(frame.id, frames[frameIndex].id)
      })
      source.texts.forEach((text, textIndex) => {
        idMap.set(text.id, texts[textIndex].id)
      })
      source.cliparts.forEach((clipart, clipartIndex) => {
        idMap.set(clipart.id, cliparts[clipartIndex].id)
      })
      ;(source.lenses ?? []).forEach((lens, lensIndex) => {
        idMap.set(lens.id, lenses[lensIndex].id)
      })
      const layerOrder = normalizeLayerOrder({ ...source, lenses })
        .map((id) => idMap.get(id))
        .filter((id): id is string => Boolean(id))
      const copy: Slide = {
        ...source,
        id: crypto.randomUUID(),
        frames,
        texts,
        cliparts,
        lenses,
        layerOrder,
        selectedId:
          frames[0]?.id ??
          texts[0]?.id ??
          cliparts[0]?.id ??
          lenses[0]?.id ??
          crypto.randomUUID(),
        background: copyBackground(source.background),
      }
      const slides = [...current.slides]
      slides.splice(index + 1, 0, copy)
      return { ...current, slides, activeSlideId: copy.id }
    })
  }, [])

  const deleteSlide = useCallback((id: string) => {
    setProject((current) => {
      if (current.slides.length <= 1) {
        const replacement = createSlide()
        return {
          ...current,
          slides: [replacement],
          activeSlideId: replacement.id,
        }
      }
      const slides = current.slides
        .filter((slide) => slide.id !== id)
        .map((slide) => sanitizeSlideSelection(slide))
      const activeSlideId =
        current.activeSlideId === id
          ? (slides[0]?.id ?? current.activeSlideId)
          : current.activeSlideId
      return { ...current, slides, activeSlideId }
    })
  }, [])

  const updateSlide = useCallback((id: string, patch: Partial<Slide>) => {
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === id ? { ...slide, ...patch } : slide,
      ),
    }))
  }, [])

  const applySlideTemplate = useCallback((id: string, templateId: TemplateId) => {
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === id ? applyTemplate(slide, templateId) : slide,
      ),
    }))
  }, [])

  const reorderSlides = useCallback((from: number, to: number) => {
    setProject((current) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= current.slides.length ||
        to >= current.slides.length
      ) {
        return current
      }
      const slides = [...current.slides]
      const [moved] = slides.splice(from, 1)
      slides.splice(to, 0, moved)
      return { ...current, slides }
    })
  }, [])

  const selectFrame = useCallback((slideId: string, frameId: string) => {
    setCanvasFocused(true)
    setProjectState((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === slideId ? { ...slide, selectedId: frameId } : slide,
      ),
    }))
  }, [])

  const addFrame = useCallback((slideId: string) => {
    setCanvasFocused(true)
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId || slide.frames.length >= MAX_FRAMES) {
          return slide
        }
        const source = getActiveFrame(slide)
        const next = createFrame(
          source
            ? {
                deviceId: source.deviceId,
                x: Math.min(88, source.x + 16),
                y: Math.min(90, source.y + 3),
                scale: Math.max(0.42, source.scale * 0.88),
                rotation: source.rotation,
                rotationX: source.rotationX,
                rotationY: source.rotationY,
              }
            : {},
        )
        return {
          ...slide,
          frames: [...slide.frames, next],
          layerOrder: appendLayerOrder(normalizeLayerOrder(slide), next.id),
          selectedId: next.id,
        }
      }),
    }))
  }, [])

  const duplicateFrame = useCallback((slideId: string, frameId: string) => {
    setCanvasFocused(true)
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId || slide.frames.length >= MAX_FRAMES) {
          return slide
        }
        const source = slide.frames.find((frame) => frame.id === frameId)
        if (!source) return slide
        const copy = createFrame({
          deviceId: source.deviceId,
          screenshotId: source.screenshotId,
          screenshotIdB: source.screenshotIdB,
          screenMode: source.screenMode,
          screenSplitAngle: source.screenSplitAngle,
          screenSplitRatio: source.screenSplitRatio,
          x: Math.min(92, source.x + 8),
          y: Math.min(92, source.y + 5),
          scale: source.scale,
          rotation: source.rotation,
          rotationX: source.rotationX,
          rotationY: source.rotationY,
          overflow: source.overflow,
        })
        const index = slide.frames.findIndex((frame) => frame.id === frameId)
        const frames = [...slide.frames]
        frames.splice(index + 1, 0, copy)
        return {
          ...slide,
          frames,
          layerOrder: appendLayerOrder(normalizeLayerOrder(slide), copy.id, frameId),
          selectedId: copy.id,
        }
      }),
    }))
  }, [])

  const removeFrame = useCallback((slideId: string, frameId: string) => {
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId) return slide
        const frames = slide.frames.filter((frame) => frame.id !== frameId)
        const cliparts = slide.cliparts.map((clipart) =>
          clipart.attachedFrameId === frameId
            ? createClipart({ ...clipart, attachedFrameId: null })
            : clipart,
        )
        return sanitizeSlideSelection({
          ...slide,
          frames,
          cliparts,
          selectedId:
            slide.selectedId === frameId
              ? (frames[frames.length - 1]?.id ??
                slide.texts[slide.texts.length - 1]?.id ??
                cliparts[cliparts.length - 1]?.id ??
                "")
              : slide.selectedId,
        })
      }),
    }))
  }, [])

  const updateFrame = useCallback(
    (slideId: string, frameId: string, patch: Partial<Frame>) => {
      setProject((current) => {
        let slides = current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            frames: slide.frames.map((frame) =>
              frame.id === frameId ? createFrame({ ...frame, ...patch }) : frame,
            ),
          }
        })
        const ownerSlide = slides.find((slide) => slide.id === slideId)
        const frame = ownerSlide?.frames.find((item) => item.id === frameId)
        if (frame?.overflow === "continue" && ownerSlide) {
          slides = ensureContinuitySlidesForFrame(
            slides,
            slideId,
            frame,
            current.targetId,
            ownerSlide,
          )
        }
        return { ...current, slides }
      })
    },
    [],
  )

  const moveFrame = useCallback(
    (slideId: string, frameId: string, direction: "forward" | "back") => {
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            layerOrder: moveInLayerOrder(
              normalizeLayerOrder(slide),
              frameId,
              direction,
            ),
          }
        }),
      }))
    },
    [],
  )

  const duplicateText = useCallback((slideId: string, textId: string) => {
    setCanvasFocused(true)
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId || slide.texts.length >= MAX_TEXTS) return slide
        const source = slide.texts.find((text) => text.id === textId)
        if (!source) return slide
        const copy = createText({
          ...source,
          id: crypto.randomUUID(),
          x: Math.min(92, source.x + 6),
          y: Math.min(92, source.y + 6),
        })
        const index = slide.texts.findIndex((text) => text.id === textId)
        const texts = [...slide.texts]
        texts.splice(index + 1, 0, copy)
        return {
          ...slide,
          texts,
          layerOrder: appendLayerOrder(normalizeLayerOrder(slide), copy.id, textId),
          selectedId: copy.id,
        }
      }),
    }))
  }, [])

  const moveText = useCallback(
    (slideId: string, textId: string, direction: "forward" | "back") => {
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            layerOrder: moveInLayerOrder(
              normalizeLayerOrder(slide),
              textId,
              direction,
            ),
          }
        }),
      }))
    },
    [],
  )

  const selectText = useCallback((slideId: string, textId: string) => {
    setCanvasFocused(true)
    setProjectState((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === slideId ? { ...slide, selectedId: textId } : slide,
      ),
    }))
  }, [])

  const addText = useCallback((slideId: string) => {
    setCanvasFocused(true)
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId || slide.texts.length >= MAX_TEXTS) return slide
        const source = getActiveText(slide) ?? slide.texts[0]
        const next = createText({
          content: "New text",
          x: source?.x ?? 50,
          y: Math.min(90, (source?.y ?? 12) + 10),
          width: source?.width ?? 86,
          font: source?.font ?? "Poppins",
          size: source?.size ?? 64,
          color: source?.color ?? "#ffffff",
          align: source?.align ?? "center",
          weight: source?.weight ?? 700,
          shadow: source?.shadow ?? 0,
          shadowOffsetX: source?.shadowOffsetX ?? 0,
          shadowOffsetY: source?.shadowOffsetY ?? 0,
          shadowOpacity: source?.shadowOpacity ?? 0,
          strokeWidth: source?.strokeWidth ?? 0,
          strokeColor: source?.strokeColor ?? "#000000",
        })
        return {
          ...slide,
          texts: [...slide.texts, next],
          layerOrder: appendLayerOrder(normalizeLayerOrder(slide), next.id),
          selectedId: next.id,
        }
      }),
    }))
  }, [])

  const removeText = useCallback((slideId: string, textId: string) => {
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId) return slide
        const texts = slide.texts.filter((text) => text.id !== textId)
        return sanitizeSlideSelection({
          ...slide,
          texts,
          selectedId:
            slide.selectedId === textId
              ? (texts[texts.length - 1]?.id ??
                slide.frames[0]?.id ??
                slide.cliparts[0]?.id ??
                "")
              : slide.selectedId,
        })
      }),
    }))
  }, [])

  const updateText = useCallback(
    (slideId: string, textId: string, patch: Partial<TextLayer>) => {
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            texts: slide.texts.map((text) =>
              text.id === textId ? { ...text, ...patch } : text,
            ),
          }
        }),
      }))
    },
    [],
  )

  const selectClipart = useCallback((slideId: string, clipartId: string) => {
    setCanvasFocused(true)
    setProjectState((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === slideId ? { ...slide, selectedId: clipartId } : slide,
      ),
    }))
  }, [])

  const addClipart = useCallback(
    (slideId: string, assetId: string, aspect = 1) => {
      setCanvasFocused(true)
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => {
          if (slide.id !== slideId || slide.cliparts.length >= MAX_CLIPARTS) {
            return slide
          }
          const next = createClipart({
            assetId,
            x: 50,
            y: 50,
            width: 24,
            aspect,
          })
          return {
            ...slide,
            cliparts: [...slide.cliparts, next],
            layerOrder: appendLayerOrder(normalizeLayerOrder(slide), next.id),
            selectedId: next.id,
          }
        }),
      }))
    },
    [],
  )

  const addLibraryClipart = useCallback(
    (slideId: string, libraryId: string, url: string) => {
      const assetId = `library:${libraryId}`
      setAssetUrls((current) => ({ ...current, [assetId]: url }))
      void probeImageAspect(url).then((aspect) => {
        addClipart(slideId, assetId, aspect)
      })
    },
    [addClipart],
  )

  const duplicateClipart = useCallback((slideId: string, clipartId: string) => {
    setCanvasFocused(true)
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId || slide.cliparts.length >= MAX_CLIPARTS) {
          return slide
        }
        const source = slide.cliparts.find((clipart) => clipart.id === clipartId)
        if (!source) return slide
        const copy = createClipart({
          ...source,
          id: crypto.randomUUID(),
          x: Math.min(92, source.x + 6),
          y: Math.min(92, source.y + 6),
        })
        const index = slide.cliparts.findIndex((clipart) => clipart.id === clipartId)
        const cliparts = [...slide.cliparts]
        cliparts.splice(index + 1, 0, copy)
        return {
          ...slide,
          cliparts,
          layerOrder: appendLayerOrder(normalizeLayerOrder(slide), copy.id, clipartId),
          selectedId: copy.id,
        }
      }),
    }))
  }, [])

  const copyComponentToSlide = useCallback(
    (sourceSlideId: string, componentId: string, targetSlideId: string) => {
      if (sourceSlideId === targetSlideId) return
      setCanvasFocused(true)
      setProject((current) => {
        const sourceSlide = current.slides.find((slide) => slide.id === sourceSlideId)
        const targetSlide = current.slides.find((slide) => slide.id === targetSlideId)
        if (!sourceSlide || !targetSlide) return current

        const frame = sourceSlide.frames.find((item) => item.id === componentId)
        if (frame) {
          if (targetSlide.frames.length >= MAX_FRAMES) return current
          const copy = createFrame({
            deviceId: frame.deviceId,
            screenshotId: frame.screenshotId,
            screenshotIdB: frame.screenshotIdB,
            screenMode: frame.screenMode,
            screenSplitAngle: frame.screenSplitAngle,
            screenSplitRatio: frame.screenSplitRatio,
            x: frame.x,
            y: frame.y,
            scale: frame.scale,
            rotation: frame.rotation,
            rotationX: frame.rotationX,
            rotationY: frame.rotationY,
            overflow: "cut",
          })
          return {
            ...current,
            activeSlideId: targetSlideId,
            slides: current.slides.map((slide) => {
              if (slide.id !== targetSlideId) return slide
              return {
                ...slide,
                frames: [...slide.frames, copy],
                layerOrder: appendLayerOrder(normalizeLayerOrder(slide), copy.id),
                selectedId: copy.id,
              }
            }),
          }
        }

        const text = sourceSlide.texts.find((item) => item.id === componentId)
        if (text) {
          if (targetSlide.texts.length >= MAX_TEXTS) return current
          const copy = createText({
            ...text,
            id: crypto.randomUUID(),
          })
          return {
            ...current,
            activeSlideId: targetSlideId,
            slides: current.slides.map((slide) => {
              if (slide.id !== targetSlideId) return slide
              return {
                ...slide,
                texts: [...slide.texts, copy],
                layerOrder: appendLayerOrder(normalizeLayerOrder(slide), copy.id),
                selectedId: copy.id,
              }
            }),
          }
        }

        const clipart = sourceSlide.cliparts.find((item) => item.id === componentId)
        if (clipart) {
          if (targetSlide.cliparts.length >= MAX_CLIPARTS) return current
          const targetHasFrame = clipart.attachedFrameId
            ? targetSlide.frames.some(
                (frame) => frame.id === clipart.attachedFrameId,
              )
            : false
          const copy = createClipart({
            ...clipart,
            id: crypto.randomUUID(),
            attachedFrameId: targetHasFrame ? clipart.attachedFrameId : null,
          })
          return {
            ...current,
            activeSlideId: targetSlideId,
            slides: current.slides.map((slide) => {
              if (slide.id !== targetSlideId) return slide
              return {
                ...slide,
                cliparts: [...slide.cliparts, copy],
                layerOrder: appendLayerOrder(normalizeLayerOrder(slide), copy.id),
                selectedId: copy.id,
              }
            }),
          }
        }

        const lens = (sourceSlide.lenses ?? []).find((item) => item.id === componentId)
        if (lens) {
          if ((targetSlide.lenses ?? []).length >= MAX_LENSES) return current
          const copy = createLens({
            ...lens,
            id: crypto.randomUUID(),
          })
          return {
            ...current,
            activeSlideId: targetSlideId,
            slides: current.slides.map((slide) => {
              if (slide.id !== targetSlideId) return slide
              return {
                ...slide,
                lenses: [...(slide.lenses ?? []), copy],
                layerOrder: appendLayerOrder(normalizeLayerOrder(slide), copy.id),
                selectedId: copy.id,
              }
            }),
          }
        }

        return current
      })
    },
    [],
  )

  const selectLens = useCallback((slideId: string, lensId: string) => {
    setCanvasFocused(true)
    setProjectState((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === slideId ? { ...slide, selectedId: lensId } : slide,
      ),
    }))
  }, [])

  const addLens = useCallback((slideId: string) => {
    setCanvasFocused(true)
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId || (slide.lenses ?? []).length >= MAX_LENSES) {
          return slide
        }
        const next = createLens({
          x: 55,
          y: 48,
          width: 42,
          height: 26,
          borderWidth: 12,
        })
        return {
          ...slide,
          lenses: [...(slide.lenses ?? []), next],
          layerOrder: appendLayerOrder(normalizeLayerOrder(slide), next.id),
          selectedId: next.id,
        }
      }),
    }))
  }, [])

  const duplicateLens = useCallback((slideId: string, lensId: string) => {
    setCanvasFocused(true)
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId || (slide.lenses ?? []).length >= MAX_LENSES) {
          return slide
        }
        const source = (slide.lenses ?? []).find((lens) => lens.id === lensId)
        if (!source) return slide
        const copy = createLens({
          ...source,
          id: crypto.randomUUID(),
          x: Math.min(92, source.x + 6),
          y: Math.min(92, source.y + 6),
        })
        const index = (slide.lenses ?? []).findIndex((lens) => lens.id === lensId)
        const lenses = [...(slide.lenses ?? [])]
        lenses.splice(index + 1, 0, copy)
        return {
          ...slide,
          lenses,
          layerOrder: appendLayerOrder(normalizeLayerOrder(slide), copy.id, lensId),
          selectedId: copy.id,
        }
      }),
    }))
  }, [])

  const removeLens = useCallback((slideId: string, lensId: string) => {
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId) return slide
        const lenses = (slide.lenses ?? []).filter((lens) => lens.id !== lensId)
        return sanitizeSlideSelection({
          ...slide,
          lenses,
          selectedId:
            slide.selectedId === lensId
              ? (lenses[lenses.length - 1]?.id ??
                slide.cliparts[slide.cliparts.length - 1]?.id ??
                slide.texts[slide.texts.length - 1]?.id ??
                slide.frames[0]?.id ??
                "")
              : slide.selectedId,
        })
      }),
    }))
  }, [])

  const updateLens = useCallback(
    (slideId: string, lensId: string, patch: Partial<LensLayer>) => {
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            lenses: (slide.lenses ?? []).map((lens) =>
              lens.id === lensId ? createLens({ ...lens, ...patch }) : lens,
            ),
          }
        }),
      }))
    },
    [],
  )

  const lockLensImage = useCallback(
    async (slideId: string, lensId: string) => {
      const current = projectRef.current
      const urls = assetUrlsRef.current
      const slideIndex = current.slides.findIndex((entry) => entry.id === slideId)
      const slide = slideIndex >= 0 ? current.slides[slideIndex] : null
      const lens = slide?.lenses?.find((entry) => entry.id === lensId)
      if (!slide || !lens) return

      const blob = await captureSlideSnapshot(
        slide,
        slideIndex,
        current.slides,
        current.targetId,
        urls,
      )
      const { id } = await storeAsset(
        new File([blob], "lens-lock.png", { type: "image/png" }),
      )

      setProject((projectNow) => ({
        ...projectNow,
        slides: projectNow.slides.map((entry) => {
          if (entry.id !== slideId) return entry
          return {
            ...entry,
            lenses: (entry.lenses ?? []).map((item) =>
              item.id === lensId
                ? createLens({
                    ...item,
                    imageLocked: true,
                    lockedX: item.x,
                    lockedY: item.y,
                    lockedImageId: id,
                  })
                : item,
            ),
          }
        }),
      }))

      const updated = projectRef.current
      if (projectId) await saveProjectRecord(projectId, updated)
      else await saveProject(updated)
      setSaveState("saved")
      setLastSavedAt(Date.now())
    },
    [storeAsset, setProject, projectId],
  )

  const moveLens = useCallback(
    (slideId: string, lensId: string, direction: "forward" | "back") => {
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            layerOrder: moveInLayerOrder(
              normalizeLayerOrder(slide),
              lensId,
              direction,
            ),
          }
        }),
      }))
    },
    [],
  )

  const removeClipart = useCallback((slideId: string, clipartId: string) => {
    setProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId) return slide
        const cliparts = slide.cliparts.filter((clipart) => clipart.id !== clipartId)
        return sanitizeSlideSelection({
          ...slide,
          cliparts,
          selectedId:
            slide.selectedId === clipartId
              ? (cliparts[cliparts.length - 1]?.id ??
                slide.texts[slide.texts.length - 1]?.id ??
                slide.frames[0]?.id ??
                "")
              : slide.selectedId,
        })
      }),
    }))
  }, [])

  const updateClipart = useCallback(
    (slideId: string, clipartId: string, patch: Partial<ClipartLayer>) => {
      setProject((current) => {
        let slides = current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            cliparts: slide.cliparts.map((clipart) =>
              clipart.id === clipartId
                ? createClipart({ ...clipart, ...patch })
                : clipart,
            ),
          }
        })
        const ownerSlide = slides.find((slide) => slide.id === slideId)
        const clipart = ownerSlide?.cliparts.find((item) => item.id === clipartId)
        if (clipart?.overflow === "continue" && ownerSlide) {
          slides = ensureContinuitySlidesForClipart(
            slides,
            slideId,
            clipart,
            current.targetId,
            ownerSlide,
          )
        }
        return { ...current, slides }
      })
    },
    [],
  )

  const moveClipart = useCallback(
    (slideId: string, clipartId: string, direction: "forward" | "back") => {
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            layerOrder: moveInLayerOrder(
              normalizeLayerOrder(slide),
              clipartId,
              direction,
            ),
          }
        }),
      }))
    },
    [],
  )

  const attachScreenshot = useCallback(
    async (
      slideId: string,
      file: File,
      frameId?: string,
      slot: FrameScreenSlot = "a",
    ) => {
      const { id } = await storeAsset(file)
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          const targetId = frameId ?? getActiveFrame(slide)?.id
          if (!targetId || !slide.frames.some((frame) => frame.id === targetId)) {
            const next = createFrame({
              screenshotId: slot === "b" ? null : id,
              screenshotIdB: slot === "b" ? id : null,
              screenMode: slot === "b" ? "split" : "single",
            })
            return {
              ...slide,
              frames: [...slide.frames, next],
              layerOrder: appendLayerOrder(normalizeLayerOrder(slide), next.id),
              selectedId: next.id,
            }
          }
          return {
            ...slide,
            frames: slide.frames.map((frame) => {
              if (frame.id !== targetId) return frame
              if (slot === "b") {
                return createFrame({
                  ...frame,
                  screenshotIdB: id,
                  screenMode: "split",
                })
              }
              return createFrame({ ...frame, screenshotId: id })
            }),
          }
        }),
      }))
    },
    [storeAsset],
  )

  const attachClipart = useCallback(
    async (slideId: string, file: File) => {
      const { id, file: normalized } = await storeAsset(file)
      const previewUrl = URL.createObjectURL(normalized)
      const aspect = await probeImageAspect(previewUrl)
      URL.revokeObjectURL(previewUrl)
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => {
          if (slide.id !== slideId || slide.cliparts.length >= MAX_CLIPARTS) {
            return slide
          }
          const next = createClipart({
            assetId: id,
            x: 50,
            y: 50,
            width: 24,
            aspect,
          })
          return {
            ...slide,
            cliparts: [...slide.cliparts, next],
            layerOrder: appendLayerOrder(normalizeLayerOrder(slide), next.id),
            selectedId: next.id,
          }
        }),
      }))
    },
    [storeAsset],
  )

  const attachBackgroundImage = useCallback(
    async (slideId: string, file: File) => {
      const { id } = await storeAsset(file)
      setProject((current) => ({
        ...current,
        slides: current.slides.map((slide) =>
          slide.id === slideId
            ? {
                ...slide,
                background: defaultBackground({
                  ...slide.background,
                  type: "image",
                  imageId: id,
                }),
              }
            : slide,
        ),
      }))
    },
    [storeAsset],
  )

  const activeSlide =
    project.slides.find((slide) => slide.id === project.activeSlideId) ??
    project.slides[0]
  const activeFrame = getActiveFrame(activeSlide)
  const activeText = getActiveText(activeSlide)
  const activeClipart = getActiveClipart(activeSlide)
  const activeLens = getActiveLens(activeSlide)
  const kind = selectedKind(activeSlide)
  const viewProject = project
  const canUndo = historyPastRef.current.length > 0
  const canRedo = historyFutureRef.current.length > 0
  void historyTick

  const deleteSelection = useCallback(() => {
    const slide = project.slides.find((entry) => entry.id === project.activeSlideId)
    if (!slide || !slide.selectedId) return
    const id = slide.selectedId
    if ((slide.lenses ?? []).some((lens) => lens.id === id)) {
      removeLens(slide.id, id)
      return
    }
    if (slide.cliparts.some((clipart) => clipart.id === id)) {
      removeClipart(slide.id, id)
      return
    }
    if (slide.texts.some((text) => text.id === id)) {
      removeText(slide.id, id)
      return
    }
    if (slide.frames.some((frame) => frame.id === id)) {
      removeFrame(slide.id, id)
    }
  }, [project, removeLens, removeClipart, removeText, removeFrame])

  const value = useMemo<ProjectContextValue>(
    () => ({
      ready,
      projectId,
      project,
      viewProject,
      assetUrls,
      libraryCliparts,
      saveState,
      lastSavedAt,
      activeSlide,
      activeFrame,
      activeText,
      activeClipart,
      activeLens,
      selectedKind: kind,
      canvasFocused,
      setName,
      setTarget,
      setSizeEditMode,
      setThumbnailLayout,
      selectSlide,
      clearSelection,
      addSlide,
      insertSlideAt,
      setFrameOverflow,
      setClipartOverflow,
      duplicateSlide,
      deleteSlide,
      updateSlide,
      applySlideTemplate,
      reorderSlides,
      selectFrame,
      selectText,
      selectClipart,
      selectLens,
      addFrame,
      duplicateFrame,
      removeFrame,
      updateFrame,
      moveFrame,
      addText,
      duplicateText,
      removeText,
      updateText,
      moveText,
      addClipart,
      addLibraryClipart,
      duplicateClipart,
      removeClipart,
      updateClipart,
      moveClipart,
      addLens,
      duplicateLens,
      removeLens,
      updateLens,
      lockLensImage,
      moveLens,
      copyComponentToSlide,
      attachScreenshot,
      attachClipart,
      attachBackgroundImage,
      saveDraft,
      undo,
      redo,
      canUndo,
      canRedo,
      deleteSelection,
    }),
    [
      ready,
      projectId,
      project,
      viewProject,
      assetUrls,
      libraryCliparts,
      saveState,
      lastSavedAt,
      activeSlide,
      activeFrame,
      activeText,
      activeClipart,
      activeLens,
      kind,
      canvasFocused,
      setName,
      setTarget,
      setSizeEditMode,
      setThumbnailLayout,
      selectSlide,
      clearSelection,
      addSlide,
      insertSlideAt,
      setFrameOverflow,
      setClipartOverflow,
      duplicateSlide,
      deleteSlide,
      updateSlide,
      applySlideTemplate,
      reorderSlides,
      selectFrame,
      selectText,
      selectClipart,
      selectLens,
      addFrame,
      duplicateFrame,
      removeFrame,
      updateFrame,
      moveFrame,
      addText,
      duplicateText,
      removeText,
      updateText,
      moveText,
      addClipart,
      addLibraryClipart,
      duplicateClipart,
      removeClipart,
      updateClipart,
      moveClipart,
      addLens,
      duplicateLens,
      removeLens,
      updateLens,
      lockLensImage,
      moveLens,
      copyComponentToSlide,
      attachScreenshot,
      attachClipart,
      attachBackgroundImage,
      saveDraft,
      undo,
      redo,
      canUndo,
      canRedo,
      deleteSelection,
      historyTick,
    ],
  )

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}

export function useProject() {
  const value = useContext(ProjectContext)
  if (!value) throw new Error("useProject must be used within ProjectProvider")
  return value
}
