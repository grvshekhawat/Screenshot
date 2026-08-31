import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import {
  canCopyComponentToSlide,
  DEVICES,
  FONTS,
  layerMoveLimits,
  MAX_CLIPARTS,
  MAX_FRAMES,
  MAX_LENSES,
  MAX_TEXTS,
  CLIPART_WIDTH_MIN,
  CLIPART_WIDTH_MAX,
  PALETTES,
  STORE_TARGETS,
  TEMPLATES,
  cssFontFamily,
  splitBackgroundCss,
  templateSplit,
  deviceShadowPreset,
  maxFittingDeviceScale,
} from "../constants"
import { storeTargetsForOrientation } from "../orientation"
import {
  artboardToAttached,
  attachedToArtboard,
  gestureAttachPreset,
  type GestureAttachPreset,
} from "../clipart-attach"
import { clipartOverflow, frameOverflow, lensOverflow, overflowsHorizontally, textOverflow } from "../overflow"
import { useProject } from "../project-store"
import type {
  DeviceId,
  Frame,
  FrameScreenSlot,
  ClipartLayer,
  LensLayer,
  SelectedKind,
  SizeEditMode,
  Slide,
  StoreTargetId,
  TextAlign,
  TextLayer,
} from "../types"
import {
  getPropertyClipboard,
  patchFromPropertyClipboard,
  propertyClipboardSummary,
  setPropertyClipboard,
  subscribePropertyClipboard,
} from "../property-clipboard"
import type { SelectionPatch } from "../selection"
import {
  getSelectedIds,
  pickSectionPatch,
  resolveSelectedLayers,
  SECTION_LABELS,
  selectionMoveOrigins,
  uniformSelectionKind,
  type PropertySectionId,
} from "../selection"
import {
  canGroupSelection,
  canUngroupSelection,
} from "../groups"
import { OverflowChoice } from "./OverflowChoice"
import { ScreenshotDropZone } from "./ScreenshotDropZone"

type PatchableLayer = Frame | TextLayer | ClipartLayer | LensLayer

type PropertyCopyContextValue = {
  kind: SelectedKind
  copySection: (section: PropertySectionId) => void
  copyField: (key: keyof SelectionPatch, label: string) => void
}

const PropertyCopyContext = createContext<PropertyCopyContextValue | null>(null)

function PropertyCopyProvider({
  kind,
  layer,
  children,
}: {
  kind: SelectedKind
  layer: PatchableLayer
  children: ReactNode
}) {
  const value: PropertyCopyContextValue = {
    kind,
    copySection: (section) => {
      const patch = pickSectionPatch(layer, section)
      if (Object.keys(patch).length === 0) return
      setPropertyClipboard({
        scope: "section",
        section,
        patch,
        sourceKind: kind,
        label: SECTION_LABELS[section],
      })
    },
    copyField: (key, label) => {
      const next = (layer as unknown as Record<string, unknown>)[key]
      if (next === undefined) return
      setPropertyClipboard({
        scope: "field",
        key,
        value: next as SelectionPatch[keyof SelectionPatch],
        sourceKind: kind,
        label,
      })
    },
  }
  return (
    <PropertyCopyContext.Provider value={value}>
      {children}
    </PropertyCopyContext.Provider>
  )
}

function usePropertyClipboardEntry() {
  return useSyncExternalStore(
    subscribePropertyClipboard,
    getPropertyClipboard,
    getPropertyClipboard,
  )
}

const ACTION_BTN =
  "inline-flex h-8 w-full items-center justify-center rounded-md border border-white/10 bg-white/[0.03] px-2 text-[11px] font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03] disabled:hover:text-zinc-300"

const ACTION_BTN_DANGER =
  "inline-flex h-8 w-full items-center justify-center rounded-md border border-red-500/25 bg-red-500/[0.08] px-2 text-[11px] font-medium text-red-300 transition hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-200"

function PastePropertiesAction({
  targetKind,
  onPaste,
}: {
  targetKind: SelectedKind
  onPaste: (patch: SelectionPatch) => void
}) {
  const entry = usePropertyClipboardEntry()
  if (!entry) return null
  const patch = patchFromPropertyClipboard(entry, targetKind)
  if (Object.keys(patch).length === 0) return null
  return (
    <button
      type="button"
      title={propertyClipboardSummary(entry)}
      className={ACTION_BTN}
      onClick={() => onPaste(patch)}
    >
      Paste props
    </button>
  )
}

function CopyPropButton({
  title,
  onClick,
}: {
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
    >
      Copy
    </button>
  )
}

export type MenuId = "content" | "background" | "template" | "export"

type InspectorProps = {
  children: ReactNode
  onUploadClick: (
    frameId?: string,
    slideId?: string,
    slot?: FrameScreenSlot,
  ) => void
  onClipartUploadClick: (slideId?: string) => void
  onBackgroundUploadClick: (slideId?: string) => void
  onScreenshotFiles: (
    files: FileList | File[],
    slideId?: string,
    frameId?: string,
    slot?: FrameScreenSlot,
  ) => void
  assetUrls: Record<string, string>
  onExportPng: () => void
  onExportZip: () => void
  onExportAllSizesZip: () => void
  canExportClean: boolean
  busy: string | null
  menu: MenuId | null
  onMenuChange: (menu: MenuId | null) => void
  onTemplatePicked?: () => void
}

const MENUS: { id: MenuId; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "background", label: "Background" },
  { id: "template", label: "Slide Template" },
  { id: "export", label: "Export" },
]

export function Inspector({
  children,
  onUploadClick,
  onClipartUploadClick,
  onBackgroundUploadClick,
  onScreenshotFiles,
  assetUrls,
  onExportPng,
  onExportZip,
  onExportAllSizesZip,
  canExportClean,
  busy,
  menu,
  onMenuChange,
  onTemplatePicked,
}: InspectorProps) {
  const {
    project,
    activeSlide,
    activeFrame,
    activeText,
    activeClipart,
    activeLens,
    selectedKind: kind,
    selectedIds,
    setTarget,
    setSizeEditMode,
    updateSlide,
    applySlideTemplate,
    selectSlide,
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
    patchSelectionCommon,
    scaleSelectionRelative,
    alignSelection,
    moveSelectionByArtboardDelta,
    deleteSelection,
    groupSelection,
    ungroupSelection,
    duplicateText,
    removeText,
    updateText,
    moveText,
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
    addLibraryClipart,
    libraryCliparts,
    copyComponentToSlide,
    setFrameOverflow,
    setClipartOverflow,
    setTextOverflow,
    setLensOverflow,
  } = useProject()

  const slide = activeSlide
  const frame = activeFrame
  const color2 = slide.background.colors[1] ?? slide.background.colors[0]
  const target = STORE_TARGETS[project.targetId]
  const edges = frame
    ? frameOverflow(frame, target.width, target.height)
    : null
  const clipartEdges = activeClipart
    ? clipartOverflow(activeClipart, target.width, target.height)
    : null
  const textEdges = activeText
    ? textOverflow(activeText, target.width, target.height)
    : null
  const lensEdges = activeLens
    ? lensOverflow(activeLens, target.width, target.height)
    : null

  const [contentTab, setContentTab] = useState<
    "phone" | "text" | "clipart" | "lens"
  >("phone")

  const selectionKey = selectedIds.join("|")

  // Canvas selection → Content panel: open Content, switch tab, highlight row.
  useEffect(() => {
    if (!selectionKey) return
    const tab =
      kind === "frame"
        ? "phone"
        : kind === "text"
          ? "text"
          : kind === "clipart"
            ? "clipart"
            : kind === "lens"
              ? "lens"
              : null
    if (!tab) return
    setContentTab(tab)
    onMenuChange("content")
  }, [kind, selectionKey, onMenuChange])

  const toggleMenu = (id: MenuId) =>
    onMenuChange(menu === id ? null : id)

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex shrink-0 border-r border-white/[0.06] bg-[#07070a]">
        <nav className="flex w-[88px] shrink-0 flex-col border-r border-white/[0.06] py-2">
          {MENUS.map((item) => {
            const active = menu === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleMenu(item.id)}
                className={`mx-1.5 rounded-lg px-2 py-3 text-center text-[11px] font-medium leading-tight transition ${
                  active
                    ? "bg-[#e8ff47] text-[#0a0a0c]"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div
          className={`overflow-hidden border-r border-white/[0.06] transition-[width] duration-200 ease-out ${
            menu ? "w-[280px]" : "w-0 border-r-0"
          }`}
        >
          {menu ? (
            <div className="flex h-full w-[280px] flex-col overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
                <h2 className="text-xs font-semibold text-zinc-200">
                  {MENUS.find((item) => item.id === menu)?.label}
                </h2>
                <button
                  type="button"
                  onClick={() => onMenuChange(null)}
                  className="text-[11px] text-zinc-500 hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 px-3 py-3">
                {menu === "content" ? (
                  <ContentTools
                    tab={contentTab}
                    onTabChange={setContentTab}
                    slide={slide}
                    selectedIds={selectedIds}
                    assetUrls={assetUrls}
                    libraryCliparts={libraryCliparts}
                    onUploadClick={onUploadClick}
                    onScreenshotFiles={onScreenshotFiles}
                    onClipartUploadClick={onClipartUploadClick}
                    selectSlide={selectSlide}
                    selectFrame={selectFrame}
                    selectText={selectText}
                    selectClipart={selectClipart}
                    selectLens={selectLens}
                    addFrame={addFrame}
                    addText={addText}
                    addLens={addLens}
                    addLibraryClipart={addLibraryClipart}
                  />
                ) : null}
                {menu === "background" ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Color
                      </h3>
                      <BackgroundColorPanel
                        slide={slide}
                        color2={color2}
                        updateSlide={updateSlide}
                      />
                    </div>
                    <div>
                      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Image
                      </h3>
                      <BackgroundImagePanel
                        slide={slide}
                        assetUrls={assetUrls}
                        onBackgroundUploadClick={onBackgroundUploadClick}
                        updateSlide={updateSlide}
                      />
                    </div>
                  </div>
                ) : null}
                {menu === "template" ? (
                  <div className="flex flex-col gap-5">
                    <TemplateSection
                      title="Layouts"
                      templates={TEMPLATES.filter((template) => !template.split)}
                      activeId={slide.templateId}
                      onSelect={(id) => {
                        applySlideTemplate(slide.id, id)
                        onTemplatePicked?.()
                      }}
                    />
                    <TemplateSection
                      title="Splits"
                      templates={TEMPLATES.filter((template) => template.split)}
                      activeId={slide.templateId}
                      onSelect={(id) => {
                        applySlideTemplate(slide.id, id)
                        onTemplatePicked?.()
                      }}
                    />
                  </div>
                ) : null}
                {menu === "export" ? (
                  <ExportPanel
                    projectTargetId={project.targetId}
                    sizeEditMode={project.sizeEditMode ?? "current"}
                    hasComponentSelection={selectedIds.length > 0}
                    targetName={target.name}
                    busy={busy}
                    canExportClean={canExportClean}
                    setTarget={setTarget}
                    setSizeEditMode={setSizeEditMode}
                    onExportPng={onExportPng}
                    onExportZip={onExportZip}
                    onExportAllSizesZip={onExportAllSizesZip}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {children}

      <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-white/[0.06] bg-[#07070a]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Properties
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-600">
            {selectedIds.length > 1
              ? `${selectedIds.length} selected`
              : kind === "frame"
                ? "Phone"
                : kind === "text"
                  ? "Text"
                  : kind === "clipart"
                    ? "Clipart"
                    : kind === "lens"
                      ? "Lens"
                      : "Nothing selected"}
          </p>
        </div>
        <div className="flex-1 px-3 py-1">
          {selectedIds.length > 1 ? (
            <MultiSelectionProperties
              count={selectedIds.length}
              primary={
                kind === "frame"
                  ? frame
                  : kind === "text"
                    ? activeText
                    : kind === "clipart"
                      ? activeClipart
                      : activeLens
              }
              kind={kind}
              selectedIds={selectedIds}
              project={project}
              patchSelectionCommon={patchSelectionCommon}
              scaleSelectionRelative={scaleSelectionRelative}
              alignSelection={alignSelection}
              moveSelectionByArtboardDelta={moveSelectionByArtboardDelta}
              deleteSelection={deleteSelection}
              groupSelection={groupSelection}
              ungroupSelection={ungroupSelection}
            />
          ) : null}
          {selectedIds.length <= 1 && kind === "frame" && frame ? (
            <PhoneProperties
              slide={slide}
              frame={frame}
              edges={edges}
              projectSlides={project.slides}
              artboardWidth={target.width}
              artboardHeight={target.height}
              landscapeArtboard={
                STORE_TARGETS[project.targetId]?.orientation === "landscape"
              }
              onUploadClick={onUploadClick}
              onScreenshotFiles={onScreenshotFiles}
              updateFrame={updateFrame}
              duplicateFrame={duplicateFrame}
              removeFrame={removeFrame}
              moveFrame={moveFrame}
              copyComponentToSlide={copyComponentToSlide}
              setFrameOverflow={setFrameOverflow}
            />
          ) : null}
          {selectedIds.length <= 1 && kind === "text" && activeText ? (
            <TextProperties
              slide={slide}
              activeText={activeText}
              edges={textEdges}
              projectSlides={project.slides}
              updateText={updateText}
              duplicateText={duplicateText}
              removeText={removeText}
              moveText={moveText}
              copyComponentToSlide={copyComponentToSlide}
              setTextOverflow={setTextOverflow}
            />
          ) : null}
          {selectedIds.length <= 1 && kind === "clipart" && activeClipart ? (
            <ClipartProperties
              slide={slide}
              activeClipart={activeClipart}
              edges={clipartEdges}
              projectSlides={project.slides}
              artboardWidth={target.width}
              artboardHeight={target.height}
              updateClipart={updateClipart}
              duplicateClipart={duplicateClipart}
              removeClipart={removeClipart}
              moveClipart={moveClipart}
              copyComponentToSlide={copyComponentToSlide}
              setClipartOverflow={setClipartOverflow}
            />
          ) : null}
          {selectedIds.length <= 1 && kind === "lens" && activeLens ? (
            <LensProperties
              slide={slide}
              activeLens={activeLens}
              edges={lensEdges}
              projectSlides={project.slides}
              updateLens={updateLens}
              lockLensImage={lockLensImage}
              duplicateLens={duplicateLens}
              removeLens={removeLens}
              moveLens={moveLens}
              copyComponentToSlide={copyComponentToSlide}
              setLensOverflow={setLensOverflow}
            />
          ) : null}
          {selectedIds.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Select a phone, text, clipart, or lens on the canvas to edit its
              properties here. Shift-click or ⌘/Ctrl-click to multi-select.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

function ContentTools({
  tab,
  onTabChange,
  slide,
  selectedIds,
  assetUrls,
  libraryCliparts,
  onUploadClick,
  onScreenshotFiles,
  onClipartUploadClick,
  selectSlide,
  selectFrame,
  selectText,
  selectClipart,
  selectLens,
  addFrame,
  addText,
  addLens,
  addLibraryClipart,
}: {
  tab: "phone" | "text" | "clipart" | "lens"
  onTabChange: (tab: "phone" | "text" | "clipart" | "lens") => void
  slide: Slide
  selectedIds: string[]
  assetUrls: Record<string, string>
  libraryCliparts: { id: string; name: string; category: string; url: string }[]
  onUploadClick: (
    frameId?: string,
    slideId?: string,
    slot?: FrameScreenSlot,
  ) => void
  onScreenshotFiles: (
    files: FileList | File[],
    slideId?: string,
    frameId?: string,
    slot?: FrameScreenSlot,
  ) => void
  onClipartUploadClick: (slideId?: string) => void
  selectSlide: (id: string) => void
  selectFrame: (slideId: string, frameId: string) => void
  selectText: (slideId: string, textId: string) => void
  selectClipart: (slideId: string, clipartId: string) => void
  selectLens: (slideId: string, lensId: string) => void
  addFrame: (slideId: string) => void
  addText: (slideId: string) => void
  addLens: (slideId: string) => void
  addLibraryClipart: (slideId: string, libraryId: string, url: string) => void
}) {
  const selectedSet = new Set(
    selectedIds.length > 0 ? selectedIds : getSelectedIds(slide),
  )
  const isRowSelected = (id: string) => selectedSet.has(id)

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-zinc-900 p-1">
        {(
          [
            ["phone", "Phone"],
            ["text", "Text"],
            ["clipart", "Clipart"],
            ["lens", "Lens"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs ${
              tab === id ? "bg-white/15 text-white" : "text-zinc-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "phone" ? (
        <>
          <button
            type="button"
            disabled={slide.frames.length >= MAX_FRAMES}
            onClick={() => addFrame(slide.id)}
            className="w-full rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-[#e8ff47]/55 hover:text-white disabled:opacity-40"
          >
            Add phone
          </button>
          <div className="mt-3 space-y-1">
            {slide.frames.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  selectSlide(slide.id)
                  selectFrame(slide.id, item.id)
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  isRowSelected(item.id)
                    ? "bg-[#e8ff47] text-[#0a0a0c]"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {DEVICES[item.deviceId].name}
                {slide.frames.length > 1 ? ` ${index + 1}` : ""}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">
            Select a phone to edit it in Properties, or upload a screenshot
            there.
          </p>
          {slide.frames.some((item) => isRowSelected(item.id)) ? (
            <div className="mt-2">
              <ScreenshotDropZone
                label="Upload screenshot"
                onClick={() =>
                  onUploadClick(
                    selectedIds.find((id) =>
                      slide.frames.some((frame) => frame.id === id),
                    ) ?? slide.selectedId,
                    slide.id,
                    "a",
                  )
                }
                onDropFiles={(files) =>
                  onScreenshotFiles(
                    files,
                    slide.id,
                    selectedIds.find((id) =>
                      slide.frames.some((frame) => frame.id === id),
                    ) ?? slide.selectedId,
                    "a",
                  )
                }
              />
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "text" ? (
        <>
          <button
            type="button"
            disabled={slide.texts.length >= MAX_TEXTS}
            onClick={() => addText(slide.id)}
            className="w-full rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-[#e8ff47]/55 hover:text-white disabled:opacity-40"
          >
            Add text
          </button>
          <div className="mt-3 space-y-1">
            {slide.texts.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectText(slide.id, item.id)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                  isRowSelected(item.id)
                    ? "bg-[#e8ff47] text-[#0a0a0c]"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {item.content.trim() || `Text ${index + 1}`}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {tab === "clipart" ? (
        <>
          <p className="mb-2 text-[11px] text-zinc-500">
            Gestures, shapes, or upload your own PNG/WebP.
          </p>
          {(() => {
            const gestures = libraryCliparts.filter((item) =>
              item.category.toLowerCase().includes("gesture"),
            )
            const shapes = libraryCliparts.filter(
              (item) => !item.category.toLowerCase().includes("gesture"),
            )
            const section = (
              title: string,
              items: typeof libraryCliparts,
            ) =>
              items.length === 0 ? null : (
                <div className="mb-3">
                  <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {title}
                  </h3>
                  <div className="grid grid-cols-4 gap-1.5">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        title={item.name}
                        disabled={slide.cliparts.length >= MAX_CLIPARTS}
                        onClick={() =>
                          addLibraryClipart(slide.id, item.id, item.url)
                        }
                        className="rounded-lg border border-white/10 bg-[#0a0a0e] p-1.5 hover:border-[#e8ff47]/55 disabled:opacity-40"
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          className="mx-auto h-10 w-10 object-contain"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )
            return (
              <>
                {section("Gestures", gestures)}
                {section(gestures.length > 0 ? "Shapes" : "Library", shapes)}
              </>
            )
          })()}
          <button
            type="button"
            disabled={slide.cliparts.length >= MAX_CLIPARTS}
            onClick={() => onClipartUploadClick(slide.id)}
            className="w-full rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-[#e8ff47]/55 hover:text-white disabled:opacity-40"
          >
            Upload clipart
          </button>
          <div className="mt-3 space-y-1">
            {slide.cliparts.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectClipart(slide.id, item.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  isRowSelected(item.id)
                    ? "bg-[#e8ff47] text-[#0a0a0c]"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {assetUrls[item.assetId] ? (
                  <img
                    src={assetUrls[item.assetId]}
                    alt=""
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 text-[10px]">
                    PNG
                  </span>
                )}
                <span>
                  Clipart {index + 1}
                  {item.attachedFrameId ? " · attached" : ""}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {tab === "lens" ? (
        <>
          <button
            type="button"
            disabled={(slide.lenses ?? []).length >= MAX_LENSES}
            onClick={() => addLens(slide.id)}
            className="w-full rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-[#e8ff47]/55 hover:text-white disabled:opacity-40"
          >
            Add lens
          </button>
          <div className="mt-3 space-y-1">
            {(slide.lenses ?? []).map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  selectSlide(slide.id)
                  selectLens(slide.id, item.id)
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  isRowSelected(item.id)
                    ? "bg-[#e8ff47] text-[#0a0a0c]"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                Lens {index + 1}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">
            Place a lens over any area to magnify it. Drag to move, resize from
            the handles, and set zoom in Properties.
          </p>
        </>
      ) : null}
    </div>
  )
}

function ExportPanel({
  projectTargetId,
  sizeEditMode,
  hasComponentSelection,
  targetName,
  busy,
  canExportClean,
  setTarget,
  setSizeEditMode,
  onExportPng,
  onExportZip,
  onExportAllSizesZip,
}: {
  projectTargetId: StoreTargetId
  sizeEditMode: SizeEditMode
  hasComponentSelection: boolean
  targetName: string
  busy: string | null
  canExportClean: boolean
  setTarget: (id: StoreTargetId) => void
  setSizeEditMode: (mode: SizeEditMode) => void
  onExportPng: () => void
  onExportZip: () => void
  onExportAllSizesZip: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] text-zinc-500">Edit mode</p>
        <div
          className="flex rounded-lg border border-white/10 p-0.5"
          role="group"
          aria-label="Size edit mode"
        >
          <button
            type="button"
            onClick={() => setSizeEditMode("current")}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
              sizeEditMode === "current"
                ? "bg-white/15 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            This size
          </button>
          <button
            type="button"
            disabled={!hasComponentSelection && sizeEditMode !== "all"}
            title={
              hasComponentSelection
                ? "Apply the selected component to every store size"
                : "Select a component first"
            }
            onClick={() => setSizeEditMode("all")}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium disabled:opacity-40 ${
              sizeEditMode === "all"
                ? "bg-white/15 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All sizes
          </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
          {sizeEditMode === "current"
            ? "Each store size keeps its own layout. Switch sizes to edit them independently."
            : "Applies the selected component to every store size (adapted). Other layers stay as-is."}
        </p>
      </div>
      <label className="block text-[11px] text-zinc-500">
        Store size
        <select
          value={projectTargetId}
          onChange={(event) =>
            setTarget(event.target.value as StoreTargetId)
          }
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a0a0e] px-2.5 py-2 text-sm text-white outline-none"
        >
          {storeTargetsForOrientation(
            STORE_TARGETS[projectTargetId]?.orientation ?? "portrait",
          ).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.width}×{item.height})
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        This project is locked to{" "}
        {STORE_TARGETS[projectTargetId]?.orientation ?? "portrait"} sizes.
        Switch Portrait / Landscape from the projects list to start the other
        orientation.
      </p>
      <div>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Slide
        </h3>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={onExportPng}
          className="w-full rounded-lg bg-[#e8ff47] px-3 py-2.5 text-sm font-semibold text-[#0a0a0c] hover:bg-[#f0ff7a] disabled:opacity-50"
        >
          {busy ??
            (canExportClean
              ? "Download this slide"
              : "Download preview (watermarked)")}
        </button>
        {!canExportClean ? (
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Free exports include a watermark. Upgrade to Pro for clean PNGs.
          </p>
        ) : null}
      </div>
      <div>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Export ZIP
        </h3>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={onExportZip}
          className="w-full rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ?? `ZIP · ${targetName}`}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={onExportAllSizesZip}
          className="mt-2 w-full rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ?? "ZIP · all store sizes"}
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          {canExportClean
            ? "All slides as clean PNGs. All sizes uses native chrome (iPhone / Pixel / iPad) and refits text + lenses to match the same magnified region."
            : "ZIP export requires Pro."}
        </p>
      </div>
    </div>
  )
}

function PhoneProperties({
  slide,
  frame,
  edges,
  projectSlides,
  artboardWidth,
  artboardHeight,
  landscapeArtboard,
  onUploadClick,
  onScreenshotFiles,
  updateFrame,
  duplicateFrame,
  removeFrame,
  moveFrame,
  copyComponentToSlide,
  setFrameOverflow,
}: {
  slide: Slide
  frame: NonNullable<ReturnType<typeof useProject>["activeFrame"]>
  edges: ReturnType<typeof frameOverflow> | null
  projectSlides: Slide[]
  artboardWidth: number
  artboardHeight: number
  landscapeArtboard: boolean
  onUploadClick: (
    frameId?: string,
    slideId?: string,
    slot?: FrameScreenSlot,
  ) => void
  onScreenshotFiles: (
    files: FileList | File[],
    slideId?: string,
    frameId?: string,
    slot?: FrameScreenSlot,
  ) => void
  updateFrame: ReturnType<typeof useProject>["updateFrame"]
  duplicateFrame: (slideId: string, frameId: string) => void
  removeFrame: (slideId: string, frameId: string) => void
  moveFrame: ReturnType<typeof useProject>["moveFrame"]
  copyComponentToSlide: ReturnType<typeof useProject>["copyComponentToSlide"]
  setFrameOverflow: ReturnType<typeof useProject>["setFrameOverflow"]
}) {
  // Same named models; landscape artboards use rotated *-land chrome.
  const deviceOptions = (Object.keys(DEVICES) as DeviceId[]).filter((id) =>
    landscapeArtboard ? id.endsWith("-land") : !id.endsWith("-land"),
  )
  const isSplit = frame.screenMode === "split"
  // 100% = largest size that still fits on the artboard (no overflow crop).
  const fitScale = maxFittingDeviceScale(
    frame.deviceId,
    artboardWidth,
    artboardHeight,
  )
  const scalePercent = Math.round((frame.scale / fitScale) * 100)

  return (
    <PropertyCopyProvider kind="frame" layer={frame}>
      <PropertyAccordion defaultOpen="screen">
      <PropertySection id="screen" title="Screen">
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          {(["single", "split"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                updateFrame(slide.id, frame.id, {
                  screenMode: mode,
                })
              }
              className={`flex-1 rounded-md px-2 py-1.5 text-xs capitalize ${
                frame.screenMode === mode
                  ? "bg-white/15 text-white"
                  : "text-zinc-400"
              }`}
            >
              {mode === "single" ? "Single" : "Split screen"}
            </button>
          ))}
        </div>

        {!isSplit ? (
          <>
            <ScreenshotDropZone
              label={
                frame.screenshotId ? "Replace screenshot" : "Add screenshot"
              }
              onClick={() => onUploadClick(frame.id, slide.id, "a")}
              onDropFiles={(files) =>
                onScreenshotFiles(files, slide.id, frame.id, "a")
              }
            />
            {frame.screenshotId ? (
              <button
                type="button"
                className="text-left text-[11px] text-red-400 hover:text-red-300"
                onClick={() =>
                  updateFrame(slide.id, frame.id, { screenshotId: null })
                }
              >
                Remove screenshot
              </button>
            ) : null}
          </>
        ) : (
          <>
            <RangeValueField
              label="Split"
              suffix="%"
              min={20}
              max={80}
              step={1}
              value={Math.round(frame.screenSplitRatio)}
              onChange={(value) =>
                updateFrame(slide.id, frame.id, { screenSplitRatio: value })
              }
            />
            <RangeValueField
              label="Angle"
              suffix="°"
              min={0}
              max={360}
              step={1}
              value={Math.round(frame.screenSplitAngle)}
              onChange={(value) =>
                updateFrame(slide.id, frame.id, { screenSplitAngle: value })
              }
            />
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Side A
              </p>
              <ScreenshotDropZone
                label={frame.screenshotId ? "Replace side A" : "Add side A"}
                className="py-2.5"
                onClick={() => onUploadClick(frame.id, slide.id, "a")}
                onDropFiles={(files) =>
                  onScreenshotFiles(files, slide.id, frame.id, "a")
                }
              />
              {frame.screenshotId ? (
                <button
                  type="button"
                  className="mt-1 text-[11px] text-red-400 hover:text-red-300"
                  onClick={() =>
                    updateFrame(slide.id, frame.id, { screenshotId: null })
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Side B
              </p>
              <ScreenshotDropZone
                label={frame.screenshotIdB ? "Replace side B" : "Add side B"}
                className="py-2.5"
                onClick={() => onUploadClick(frame.id, slide.id, "b")}
                onDropFiles={(files) =>
                  onScreenshotFiles(files, slide.id, frame.id, "b")
                }
              />
              {frame.screenshotIdB ? (
                <button
                  type="button"
                  className="mt-1 text-[11px] text-red-400 hover:text-red-300"
                  onClick={() =>
                    updateFrame(slide.id, frame.id, { screenshotIdB: null })
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
          </>
        )}
        <div>
          <p className="mb-1.5 text-[11px] text-zinc-500">Device</p>
          <div className="grid grid-cols-1 gap-1.5">
            {deviceOptions.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  updateFrame(slide.id, frame.id, { deviceId: id })
                }
                className={`rounded-lg px-3 py-2 text-left text-sm ${
                  frame.deviceId === id
                    ? "bg-[#e8ff47] text-[#0a0a0c]"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {DEVICES[id].name}
              </button>
            ))}
          </div>
        </div>
      </PropertySection>

      <PropertySection id="position" title="Position" copySection="position">
        <PositionAlignControls
          x={frame.x}
          y={frame.y}
          onChange={(patch) => updateFrame(slide.id, frame.id, patch)}
        />
      </PropertySection>

      <PropertySection id="transform" title="Transform" copySection="transform">
        <RangeValueField
          label="Scale"
          suffix="%"
          min={40}
          max={110}
          step={1}
          value={Math.min(110, Math.max(40, scalePercent))}
          copyKey="scale"
          onChange={(value) =>
            updateFrame(slide.id, frame.id, {
              scale: (value / 100) * fitScale,
            })
          }
        />
        <RangeValueField
          label="Tilt X"
          suffix="°"
          min={-45}
          max={45}
          step={1}
          value={frame.rotationX}
          copyKey="rotationX"
          onChange={(value) =>
            updateFrame(slide.id, frame.id, { rotationX: value })
          }
        />
        <RangeValueField
          label="Tilt Y"
          suffix="°"
          min={-45}
          max={45}
          step={1}
          value={frame.rotationY}
          copyKey="rotationY"
          onChange={(value) =>
            updateFrame(slide.id, frame.id, { rotationY: value })
          }
        />
        <RangeValueField
          label="Spin"
          suffix="°"
          min={-180}
          max={180}
          step={1}
          value={frame.rotation}
          copyKey="rotation"
          onChange={(value) =>
            updateFrame(slide.id, frame.id, { rotation: value })
          }
        />
        <FlipControls
          flipH={frame.flipH}
          flipV={frame.flipV}
          onChange={(patch) => updateFrame(slide.id, frame.id, patch)}
        />
      </PropertySection>

      <ShadowSection
        value={frame}
        softSize={24}
        onChange={(patch) => updateFrame(slide.id, frame.id, patch)}
      />

      {edges && overflowsHorizontally(edges) ? (
        <PropertySection id="edges" title="Edges">
          <OverflowChoice
            mode={frame.overflow}
            edges={edges}
            noun="phone"
            onCut={() => setFrameOverflow(slide.id, frame.id, "cut", edges)}
            onContinue={() =>
              setFrameOverflow(slide.id, frame.id, "continue", edges)
            }
          />
        </PropertySection>
      ) : null}
      </PropertyAccordion>

      <ActionRow>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => duplicateFrame(slide.id, frame.id)}
          disabled={slide.frames.length >= MAX_FRAMES}
        >
          Duplicate
        </button>
        <CopyToSlideControl
          kind="frame"
          sourceSlideId={slide.id}
          componentId={frame.id}
          slides={projectSlides}
          onCopy={copyComponentToSlide}
        />
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => moveFrame(slide.id, frame.id, "forward")}
          disabled={!layerMoveLimits(slide, frame.id).canMoveUp}
        >
          Move up
        </button>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => moveFrame(slide.id, frame.id, "back")}
          disabled={!layerMoveLimits(slide, frame.id).canMoveDown}
        >
          Move down
        </button>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() =>
            updateFrame(slide.id, frame.id, {
              x: 50,
              y: 58,
              rotation: 0,
              rotationX: 0,
              rotationY: 0,
              flipH: false,
              flipV: false,
            })
          }
        >
          Reset position
        </button>
        <PastePropertiesAction
          targetKind="frame"
          onPaste={(patch) => updateFrame(slide.id, frame.id, patch)}
        />
        <button
          type="button"
          className={`${ACTION_BTN_DANGER} col-span-2`}
          onClick={() => removeFrame(slide.id, frame.id)}
        >
          Delete
        </button>
      </ActionRow>
    </PropertyCopyProvider>
  )
}

function TextProperties({
  slide,
  activeText,
  edges,
  projectSlides,
  updateText,
  duplicateText,
  removeText,
  moveText,
  copyComponentToSlide,
  setTextOverflow,
}: {
  slide: Slide
  activeText: NonNullable<ReturnType<typeof useProject>["activeText"]>
  edges: ReturnType<typeof textOverflow> | null
  projectSlides: Slide[]
  updateText: ReturnType<typeof useProject>["updateText"]
  duplicateText: (slideId: string, textId: string) => void
  removeText: (slideId: string, textId: string) => void
  moveText: ReturnType<typeof useProject>["moveText"]
  copyComponentToSlide: ReturnType<typeof useProject>["copyComponentToSlide"]
  setTextOverflow: ReturnType<typeof useProject>["setTextOverflow"]
}) {
  return (
    <PropertyCopyProvider kind="text" layer={activeText}>
      <PropertyAccordion defaultOpen="content">
      <PropertySection id="content" title="Content">
        <label className="block text-[11px] text-zinc-500">
          Content
          <textarea
            rows={3}
            value={activeText.content}
            onChange={(event) =>
              updateText(slide.id, activeText.id, {
                content: event.target.value,
              })
            }
            className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-[#0a0a0e] px-2.5 py-2 text-sm text-white outline-none focus:border-[#e8ff47]/50"
          />
        </label>
        <label className="block text-[11px] text-zinc-500">
          Font
          <select
            value={activeText.font}
            onChange={(event) =>
              updateText(slide.id, activeText.id, { font: event.target.value })
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a0a0e] px-2.5 py-2 text-sm text-white outline-none"
          >
            {FONTS.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
        </label>
        <p
          className="truncate text-lg text-white"
          style={{
            fontFamily: cssFontFamily(activeText.font),
            fontWeight: activeText.weight,
          }}
        >
          {activeText.content.trim() || "Font preview"}
        </p>
        <label className="block text-[11px] text-zinc-500">
          Size
          <div className="mt-1 flex items-center gap-2">
            <input
              type="range"
              min={12}
              max={Math.max(200, activeText.size)}
              value={activeText.size}
              onChange={(event) =>
                updateText(slide.id, activeText.id, {
                  size: Number(event.target.value),
                })
              }
              style={rangeFillStyle(
                activeText.size,
                12,
                Math.max(200, activeText.size),
              )}
              className="range-thin min-w-0 flex-1"
            />
            <input
              type="number"
              min={1}
              value={activeText.size}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isFinite(next)) return
                updateText(slide.id, activeText.id, {
                  size: Math.max(1, Math.round(next)),
                })
              }}
              className="w-16 rounded-md border border-white/10 bg-[#0a0a0e] px-1.5 py-1 text-right font-mono text-xs text-zinc-200"
              aria-label="Text size in pixels"
            />
            <span className="text-[10px] text-zinc-600">px</span>
          </div>
        </label>
        <div>
          <p className="mb-1.5 text-[11px] text-zinc-500">Weight</p>
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {([400, 500, 600, 700, 800] as const).map((weight) => (
              <button
                key={weight}
                type="button"
                onClick={() =>
                  updateText(slide.id, activeText.id, { weight })
                }
                className={`flex-1 rounded-md px-1 py-1.5 text-[11px] ${
                  activeText.weight === weight
                    ? "bg-white/15 text-white"
                    : "text-zinc-400"
                }`}
              >
                {weight}
              </button>
            ))}
          </div>
        </div>
        <ColorField
          label="Color"
          value={activeText.color}
          onChange={(value) =>
            updateText(slide.id, activeText.id, { color: value })
          }
        />
        <div>
          <p className="mb-1.5 text-[11px] text-zinc-500">Align</p>
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {(["left", "center", "right"] as TextAlign[]).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => updateText(slide.id, activeText.id, { align })}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs capitalize ${
                  activeText.align === align
                    ? "bg-white/15 text-white"
                    : "text-zinc-400"
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>
      </PropertySection>

      <PropertySection id="position" title="Position" copySection="position">
        <PositionAlignControls
          x={activeText.x}
          y={activeText.y}
          onChange={(patch) => updateText(slide.id, activeText.id, patch)}
        />
      </PropertySection>

      <PropertySection id="transform" title="Transform" copySection="transform">
        <RangeValueField
          label="Tilt X"
          suffix="°"
          min={-45}
          max={45}
          step={1}
          value={activeText.rotationX ?? 0}
          copyKey="rotationX"
          onChange={(value) =>
            updateText(slide.id, activeText.id, { rotationX: value })
          }
        />
        <RangeValueField
          label="Tilt Y"
          suffix="°"
          min={-45}
          max={45}
          step={1}
          value={activeText.rotationY ?? 0}
          copyKey="rotationY"
          onChange={(value) =>
            updateText(slide.id, activeText.id, { rotationY: value })
          }
        />
        <RangeValueField
          label="Spin"
          suffix="°"
          min={-180}
          max={180}
          step={1}
          value={activeText.rotation}
          copyKey="rotation"
          onChange={(value) =>
            updateText(slide.id, activeText.id, { rotation: value })
          }
        />
        <FlipControls
          flipH={activeText.flipH}
          flipV={activeText.flipV}
          onChange={(patch) => updateText(slide.id, activeText.id, patch)}
        />
      </PropertySection>

      <PropertySection id="style" title="Style" copySection="style">
        <RangeValueField
          label="Outline"
          suffix="px"
          min={0}
          max={24}
          step={1}
          value={activeText.strokeWidth ?? 0}
          copyKey="strokeWidth"
          onChange={(value) =>
            updateText(slide.id, activeText.id, { strokeWidth: value })
          }
        />
        {(activeText.strokeWidth ?? 0) > 0 ? (
          <ColorField
            label="Outline color"
            value={activeText.strokeColor || "#000000"}
            copyKey="strokeColor"
            onChange={(value) =>
              updateText(slide.id, activeText.id, { strokeColor: value })
            }
          />
        ) : null}
      </PropertySection>

      <ShadowSection
        value={activeText}
        softSize={Math.max(12, activeText.size * 0.18)}
        blurMax={48}
        onChange={(patch) => updateText(slide.id, activeText.id, patch)}
      />

      {edges && overflowsHorizontally(edges) ? (
        <PropertySection id="edges" title="Edges">
          <OverflowChoice
            mode={activeText.overflow}
            edges={edges}
            noun="text"
            onCut={() => setTextOverflow(slide.id, activeText.id, "cut")}
            onContinue={() =>
              setTextOverflow(slide.id, activeText.id, "continue")
            }
          />
        </PropertySection>
      ) : null}
      </PropertyAccordion>

      <ActionRow>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => duplicateText(slide.id, activeText.id)}
          disabled={slide.texts.length >= MAX_TEXTS}
        >
          Duplicate
        </button>
        <CopyToSlideControl
          kind="text"
          sourceSlideId={slide.id}
          componentId={activeText.id}
          slides={projectSlides}
          onCopy={copyComponentToSlide}
        />
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => moveText(slide.id, activeText.id, "forward")}
          disabled={!layerMoveLimits(slide, activeText.id).canMoveUp}
        >
          Move up
        </button>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => moveText(slide.id, activeText.id, "back")}
          disabled={!layerMoveLimits(slide, activeText.id).canMoveDown}
        >
          Move down
        </button>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() =>
            updateText(slide.id, activeText.id, {
              x: 50,
              y: 12,
              rotation: 0,
              rotationX: 0,
              rotationY: 0,
              flipH: false,
              flipV: false,
            })
          }
        >
          Reset position
        </button>
        <PastePropertiesAction
          targetKind="text"
          onPaste={(patch) => updateText(slide.id, activeText.id, patch)}
        />
        <button
          type="button"
          className={`${ACTION_BTN_DANGER} col-span-2`}
          onClick={() => removeText(slide.id, activeText.id)}
        >
          Delete
        </button>
      </ActionRow>
    </PropertyCopyProvider>
  )
}

function ClipartProperties({
  slide,
  activeClipart,
  edges,
  projectSlides,
  artboardWidth,
  artboardHeight,
  updateClipart,
  duplicateClipart,
  removeClipart,
  moveClipart,
  copyComponentToSlide,
  setClipartOverflow,
}: {
  slide: Slide
  activeClipart: NonNullable<ReturnType<typeof useProject>["activeClipart"]>
  edges: ReturnType<typeof clipartOverflow> | null
  projectSlides: Slide[]
  artboardWidth: number
  artboardHeight: number
  updateClipart: ReturnType<typeof useProject>["updateClipart"]
  duplicateClipart: (slideId: string, clipartId: string) => void
  removeClipart: (slideId: string, clipartId: string) => void
  moveClipart: ReturnType<typeof useProject>["moveClipart"]
  copyComponentToSlide: ReturnType<typeof useProject>["copyComponentToSlide"]
  setClipartOverflow: ReturnType<typeof useProject>["setClipartOverflow"]
}) {
  const attachFrameId = activeClipart.attachedFrameId
  const applyAttach = (frameId: string | null) => {
    if (!frameId) {
      const frame = attachFrameId
        ? slide.frames.find((item) => item.id === attachFrameId)
        : null
      if (frame) {
        const pose = attachedToArtboard(
          activeClipart,
          frame,
          artboardWidth,
          artboardHeight,
        )
        updateClipart(slide.id, activeClipart.id, {
          ...pose,
          attachedFrameId: null,
        })
        return
      }
      updateClipart(slide.id, activeClipart.id, { attachedFrameId: null })
      return
    }
    const frame = slide.frames.find((item) => item.id === frameId)
    if (!frame) return
    const pose = artboardToAttached(
      activeClipart,
      frame,
      artboardWidth,
      artboardHeight,
    )
    updateClipart(slide.id, activeClipart.id, {
      ...pose,
      attachedFrameId: frameId,
      overflow: "cut",
    })
  }

  const applyPreset = (preset: GestureAttachPreset) => {
    if (!attachFrameId) return
    updateClipart(slide.id, activeClipart.id, gestureAttachPreset(preset))
  }

  return (
    <PropertyCopyProvider kind="clipart" layer={activeClipart}>
      <PropertyAccordion defaultOpen="attach">
      <PropertySection id="attach" title="Attach">
        <label className="block text-[11px] text-zinc-500">
          Attach to phone
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a0a0e] px-3 py-2 text-sm text-zinc-200"
            value={attachFrameId ?? ""}
            onChange={(event) =>
              applyAttach(event.target.value ? event.target.value : null)
            }
          >
            <option value="">None (free on slide)</option>
            {slide.frames.map((frame, index) => (
              <option key={frame.id} value={frame.id}>
                Phone {index + 1}
              </option>
            ))}
          </select>
        </label>
        {attachFrameId ? (
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                ["hold-left", "Hold left"],
                ["hold-right", "Hold right"],
                ["point", "Point"],
                ["tap", "Tap"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className="rounded-md bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </PropertySection>

      <PropertySection id="position" title="Position" copySection="position">
        <PositionAlignControls
          x={activeClipart.x}
          y={activeClipart.y}
          mode={attachFrameId ? "attached" : "slide"}
          onChange={(patch) => updateClipart(slide.id, activeClipart.id, patch)}
        />
      </PropertySection>

      <PropertySection id="transform" title="Transform" copySection="transform">
        <RangeValueField
          label="Scale"
          suffix="%"
          min={CLIPART_WIDTH_MIN}
          max={CLIPART_WIDTH_MAX}
          step={1}
          value={Math.round(activeClipart.width)}
          copyKey="width"
          onChange={(value) =>
            updateClipart(slide.id, activeClipart.id, { width: value })
          }
        />
        <RangeValueField
          label="Tilt X"
          suffix="°"
          min={-45}
          max={45}
          step={1}
          value={activeClipart.rotationX ?? 0}
          copyKey="rotationX"
          onChange={(value) =>
            updateClipart(slide.id, activeClipart.id, { rotationX: value })
          }
        />
        <RangeValueField
          label="Tilt Y"
          suffix="°"
          min={-45}
          max={45}
          step={1}
          value={activeClipart.rotationY ?? 0}
          copyKey="rotationY"
          onChange={(value) =>
            updateClipart(slide.id, activeClipart.id, { rotationY: value })
          }
        />
        <RangeValueField
          label="Spin"
          suffix="°"
          min={-180}
          max={180}
          step={1}
          value={activeClipart.rotation}
          copyKey="rotation"
          onChange={(value) =>
            updateClipart(slide.id, activeClipart.id, { rotation: value })
          }
        />
        <FlipControls
          flipH={activeClipart.flipH}
          flipV={activeClipart.flipV}
          onChange={(patch) =>
            updateClipart(slide.id, activeClipart.id, patch)
          }
        />
      </PropertySection>

      <PropertySection id="style" title="Style" copySection="style">
        <RangeValueField
          label="Opacity"
          suffix="%"
          min={0}
          max={100}
          step={1}
          value={Math.round((activeClipart.opacity ?? 1) * 100)}
          copyKey="opacity"
          onChange={(value) =>
            updateClipart(slide.id, activeClipart.id, { opacity: value / 100 })
          }
        />
        <RangeValueField
          label="Blur"
          suffix="px"
          min={0}
          max={48}
          step={1}
          value={activeClipart.blur ?? 0}
          copyKey="blur"
          onChange={(value) =>
            updateClipart(slide.id, activeClipart.id, { blur: value })
          }
        />
        <div>
          <p className="mb-1.5 text-[11px] text-zinc-500">Recolor</p>
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {(
              [
                ["off", "Original"],
                ["solid", "Solid"],
                ["gradient", "Gradient"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  updateClipart(slide.id, activeClipart.id, { recolor: mode })
                }
                className={`flex-1 rounded-md px-2 py-1.5 text-[11px] ${
                  (activeClipart.recolor ?? "off") === mode
                    ? "bg-[#e8ff47] text-[#0a0a0c]"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {(activeClipart.recolor ?? "off") !== "off" ? (
          <div className="flex flex-col gap-2">
            <ColorField
              label={
                (activeClipart.recolor ?? "off") === "gradient"
                  ? "Color A"
                  : "Color"
              }
              value={activeClipart.color ?? "#fbbf24"}
              copyKey="color"
              onChange={(value) =>
                updateClipart(slide.id, activeClipart.id, { color: value })
              }
            />
            {(activeClipart.recolor ?? "off") === "gradient" ? (
              <ColorField
                label="Color B"
                value={activeClipart.color2 ?? "#f97316"}
                copyKey="color2"
                onChange={(value) =>
                  updateClipart(slide.id, activeClipart.id, { color2: value })
                }
              />
            ) : null}
          </div>
        ) : null}
        {(activeClipart.recolor ?? "off") === "gradient" ? (
          <RangeValueField
            label="Gradient angle"
            suffix="°"
            min={0}
            max={360}
            step={1}
            value={activeClipart.colorAngle ?? 135}
            copyKey="colorAngle"
            onChange={(value) =>
              updateClipart(slide.id, activeClipart.id, { colorAngle: value })
            }
          />
        ) : null}
      </PropertySection>

      <ShadowSection
        value={activeClipart}
        softSize={16}
        onChange={(patch) => updateClipart(slide.id, activeClipart.id, patch)}
      />

      {edges && overflowsHorizontally(edges) ? (
        <PropertySection id="edges" title="Edges">
          <OverflowChoice
            mode={activeClipart.overflow}
            edges={edges}
            noun="clipart"
            onCut={() =>
              setClipartOverflow(slide.id, activeClipart.id, "cut", edges)
            }
            onContinue={() =>
              setClipartOverflow(slide.id, activeClipart.id, "continue", edges)
            }
          />
        </PropertySection>
      ) : null}
      </PropertyAccordion>

      <ActionRow>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => duplicateClipart(slide.id, activeClipart.id)}
          disabled={slide.cliparts.length >= MAX_CLIPARTS}
        >
          Duplicate
        </button>
        <CopyToSlideControl
          kind="clipart"
          sourceSlideId={slide.id}
          componentId={activeClipart.id}
          slides={projectSlides}
          onCopy={copyComponentToSlide}
        />
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => moveClipart(slide.id, activeClipart.id, "forward")}
          disabled={!layerMoveLimits(slide, activeClipart.id).canMoveUp}
        >
          Move up
        </button>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => moveClipart(slide.id, activeClipart.id, "back")}
          disabled={!layerMoveLimits(slide, activeClipart.id).canMoveDown}
        >
          Move down
        </button>
        <PastePropertiesAction
          targetKind="clipart"
          onPaste={(patch) =>
            updateClipart(slide.id, activeClipart.id, patch)
          }
        />
        <button
          type="button"
          className={`${ACTION_BTN_DANGER} col-span-2`}
          onClick={() => removeClipart(slide.id, activeClipart.id)}
        >
          Delete
        </button>
      </ActionRow>
    </PropertyCopyProvider>
  )
}

function LensProperties({
  slide,
  activeLens,
  edges,
  projectSlides,
  updateLens,
  lockLensImage,
  duplicateLens,
  removeLens,
  moveLens,
  copyComponentToSlide,
  setLensOverflow,
}: {
  slide: Slide
  activeLens: NonNullable<ReturnType<typeof useProject>["activeLens"]>
  edges: ReturnType<typeof lensOverflow> | null
  projectSlides: Slide[]
  updateLens: ReturnType<typeof useProject>["updateLens"]
  lockLensImage: ReturnType<typeof useProject>["lockLensImage"]
  duplicateLens: (slideId: string, lensId: string) => void
  removeLens: (slideId: string, lensId: string) => void
  moveLens: ReturnType<typeof useProject>["moveLens"]
  copyComponentToSlide: ReturnType<typeof useProject>["copyComponentToSlide"]
  setLensOverflow: ReturnType<typeof useProject>["setLensOverflow"]
}) {
  const [locking, setLocking] = useState(false)
  const isLocked =
    activeLens.imageLocked || Boolean(activeLens.lockedImageId)

  const toggleLock = () => {
    if (locking) return
    if (isLocked) {
      updateLens(slide.id, activeLens.id, {
        imageLocked: false,
        lockedImageId: null,
      })
      return
    }
    setLocking(true)
    void lockLensImage(slide.id, activeLens.id).finally(() => setLocking(false))
  }

  return (
    <PropertyCopyProvider kind="lens" layer={activeLens}>
      <PropertyAccordion defaultOpen="image">
      <PropertySection id="image" title="Image">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-zinc-300">
            Lock image{locking ? "…" : ""}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isLocked}
            disabled={locking}
            onClick={toggleLock}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              isLocked ? "bg-[#e8ff47]" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isLocked ? "translate-x-5" : ""
              }`}
            />
          </button>
        </label>
      </PropertySection>

      <PropertySection id="position" title="Position" copySection="position">
        <PositionAlignControls
          x={activeLens.x}
          y={activeLens.y}
          onChange={(patch) => updateLens(slide.id, activeLens.id, patch)}
        />
      </PropertySection>

      <PropertySection id="transform" title="Transform" copySection="transform">
        <RangeValueField
          label="Width"
          suffix="%"
          min={6}
          max={100}
          step={1}
          value={activeLens.width}
          copyKey="width"
          onChange={(value) =>
            updateLens(slide.id, activeLens.id, { width: value })
          }
        />
        <RangeValueField
          label="Height"
          suffix="%"
          min={6}
          max={100}
          step={1}
          value={activeLens.height}
          copyKey="height"
          onChange={(value) =>
            updateLens(slide.id, activeLens.id, { height: value })
          }
        />
        <RangeValueField
          label="Zoom"
          suffix="×"
          min={1.25}
          max={4}
          step={0.05}
          value={activeLens.zoom}
          copyKey="zoom"
          onChange={(value) =>
            updateLens(slide.id, activeLens.id, { zoom: value })
          }
        />
        <RangeValueField
          label="Tilt X"
          suffix="°"
          min={-45}
          max={45}
          step={1}
          value={activeLens.rotationX ?? 0}
          copyKey="rotationX"
          onChange={(value) =>
            updateLens(slide.id, activeLens.id, { rotationX: value })
          }
        />
        <RangeValueField
          label="Tilt Y"
          suffix="°"
          min={-45}
          max={45}
          step={1}
          value={activeLens.rotationY ?? 0}
          copyKey="rotationY"
          onChange={(value) =>
            updateLens(slide.id, activeLens.id, { rotationY: value })
          }
        />
        <RangeValueField
          label="Spin"
          suffix="°"
          min={-180}
          max={180}
          step={1}
          value={activeLens.rotation ?? 0}
          copyKey="rotation"
          onChange={(value) =>
            updateLens(slide.id, activeLens.id, { rotation: value })
          }
        />
        <FlipControls
          flipH={activeLens.flipH}
          flipV={activeLens.flipV}
          onChange={(patch) => updateLens(slide.id, activeLens.id, patch)}
        />
      </PropertySection>

      <PropertySection id="style" title="Style" copySection="style">
        <RangeValueField
          label="Corner roundness"
          suffix="%"
          min={0}
          max={50}
          step={1}
          value={activeLens.cornerRadius}
          copyKey="cornerRadius"
          onChange={(value) =>
            updateLens(slide.id, activeLens.id, { cornerRadius: value })
          }
        />
        <RangeValueField
          label="Border"
          suffix="px"
          min={0}
          max={160}
          step={1}
          value={activeLens.borderWidth}
          copyKey="borderWidth"
          onChange={(value) =>
            updateLens(slide.id, activeLens.id, { borderWidth: value })
          }
        />
        <ColorField
          label="Border color"
          value={activeLens.borderColor}
          copyKey="borderColor"
          onChange={(value) =>
            updateLens(slide.id, activeLens.id, { borderColor: value })
          }
        />
      </PropertySection>

      <ShadowSection
        value={activeLens}
        softSize={18}
        onChange={(patch) => updateLens(slide.id, activeLens.id, patch)}
      />

      {edges && overflowsHorizontally(edges) ? (
        <PropertySection id="edges" title="Edges">
          <OverflowChoice
            mode={activeLens.overflow}
            edges={edges}
            noun="lens"
            onCut={() => setLensOverflow(slide.id, activeLens.id, "cut")}
            onContinue={() =>
              setLensOverflow(slide.id, activeLens.id, "continue")
            }
          />
        </PropertySection>
      ) : null}
      </PropertyAccordion>

      <ActionRow>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => duplicateLens(slide.id, activeLens.id)}
          disabled={(slide.lenses ?? []).length >= MAX_LENSES}
        >
          Duplicate
        </button>
        <CopyToSlideControl
          kind="lens"
          sourceSlideId={slide.id}
          componentId={activeLens.id}
          slides={projectSlides}
          onCopy={copyComponentToSlide}
        />
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => moveLens(slide.id, activeLens.id, "forward")}
          disabled={!layerMoveLimits(slide, activeLens.id).canMoveUp}
        >
          Move up
        </button>
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => moveLens(slide.id, activeLens.id, "back")}
          disabled={!layerMoveLimits(slide, activeLens.id).canMoveDown}
        >
          Move down
        </button>
        <PastePropertiesAction
          targetKind="lens"
          onPaste={(patch) => updateLens(slide.id, activeLens.id, patch)}
        />
        <button
          type="button"
          className={`${ACTION_BTN_DANGER} col-span-2`}
          onClick={() => removeLens(slide.id, activeLens.id)}
        >
          Delete
        </button>
      </ActionRow>
    </PropertyCopyProvider>
  )
}

function TemplateSection({
  title,
  templates,
  activeId,
  onSelect,
}: {
  title: string
  templates: (typeof TEMPLATES)[number][]
  activeId: string
  onSelect: (id: (typeof TEMPLATES)[number]["id"]) => void
}) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            className={`overflow-hidden rounded-lg text-left ring-offset-2 ring-offset-zinc-950 ${
              activeId === template.id
                ? "ring-2 ring-[#e8ff47]"
                : "ring-1 ring-zinc-800 hover:ring-zinc-600"
            }`}
          >
            <div
              className="h-14"
              style={{
                background: template.split
                  ? splitBackgroundCss(
                      template.split,
                      template.background.colors,
                    )
                  : `linear-gradient(${template.background.angle}deg, ${template.background.colors[0]}, ${template.background.colors[1]})`,
              }}
            />
            <div className="px-2 py-1.5 text-[11px] text-zinc-300">
              {template.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function BackgroundColorPanel({
  slide,
  color2,
  updateSlide,
}: {
  slide: Slide
  color2: string
  updateSlide: ReturnType<typeof useProject>["updateSlide"]
}) {
  const isHardSplit = Boolean(templateSplit(slide.templateId))
  return (
    <>
      <div className="mb-3 flex gap-1 rounded-lg bg-zinc-900 p-1">
        {(["solid", "gradient"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() =>
              updateSlide(slide.id, {
                background: { ...slide.background, type, imageId: null },
              })
            }
            className={`flex-1 rounded-md px-2 py-1.5 text-xs capitalize ${
              slide.background.type === type
                ? "bg-white/15 text-white"
                : "text-zinc-400"
            }`}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <ColorField
          label="Color 1"
          value={slide.background.colors[0]}
          onChange={(value) =>
            updateSlide(slide.id, {
              background: {
                ...slide.background,
                colors: [value, color2],
              },
            })
          }
        />
        {slide.background.type === "gradient" || isHardSplit ? (
          <ColorField
            label="Color 2"
            value={color2}
            onChange={(value) =>
              updateSlide(slide.id, {
                background: {
                  ...slide.background,
                  colors: [slide.background.colors[0], value],
                },
              })
            }
          />
        ) : null}
      </div>
      {slide.background.type === "gradient" && !isHardSplit ? (
        <label className="mt-3 block text-[11px] text-zinc-500">
          Angle {slide.background.angle}°
          <input
            type="range"
            min={0}
            max={360}
            value={slide.background.angle}
            onChange={(event) =>
              updateSlide(slide.id, {
                background: {
                  ...slide.background,
                  angle: Number(event.target.value),
                },
              })
            }
            style={rangeFillStyle(slide.background.angle, 0, 360)}
            className="range-thin mt-1.5 w-full"
          />
        </label>
      ) : null}
      <div className="mt-3 grid grid-cols-8 gap-1.5">
        {PALETTES.map((palette) => (
          <button
            key={palette.name}
            type="button"
            title={palette.name}
            onClick={() =>
              updateSlide(slide.id, {
                background: {
                  ...slide.background,
                  type: "gradient",
                  colors: [...palette.colors],
                  angle: slide.background.angle,
                  imageId: null,
                },
              })
            }
            className="h-6 rounded-md ring-1 ring-white/10"
            style={{
              background: `linear-gradient(135deg, ${palette.colors[0]}, ${palette.colors[1]})`,
            }}
          />
        ))}
      </div>
    </>
  )
}

function BackgroundImagePanel({
  slide,
  assetUrls,
  onBackgroundUploadClick,
  updateSlide,
}: {
  slide: Slide
  assetUrls: Record<string, string>
  onBackgroundUploadClick: (slideId?: string) => void
  updateSlide: ReturnType<typeof useProject>["updateSlide"]
}) {
  return (
    <>
      <button
        type="button"
        onClick={() =>
          updateSlide(slide.id, {
            background: { ...slide.background, type: "image" },
          })
        }
        className={`mb-3 w-full rounded-lg px-3 py-2 text-sm ${
          slide.background.type === "image"
            ? "bg-[#e8ff47] text-[#0a0a0c]"
            : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
        }`}
      >
        Use image background
      </button>
      <button
        type="button"
        onClick={() => onBackgroundUploadClick(slide.id)}
        className="w-full rounded-lg border border-dashed border-zinc-700 px-3 py-3 text-sm text-zinc-300 hover:border-[#e8ff47]/55 hover:text-white"
      >
        {slide.background.imageId
          ? "Replace background image"
          : "Upload background image"}
      </button>
      {slide.background.imageId ? (
        <button
          type="button"
          className="mt-2 text-[11px] text-red-400 hover:text-red-300"
          onClick={() =>
            updateSlide(slide.id, {
              background: {
                ...slide.background,
                imageId: null,
                type: "gradient",
              },
            })
          }
        >
          Remove background image
        </button>
      ) : null}
      <div className="mt-3 flex gap-1 rounded-lg bg-zinc-900 p-1">
        {(["cover", "contain"] as const).map((fit) => (
          <button
            key={fit}
            type="button"
            onClick={() =>
              updateSlide(slide.id, {
                background: { ...slide.background, imageFit: fit },
              })
            }
            className={`flex-1 rounded-md px-2 py-1.5 text-xs capitalize ${
              slide.background.imageFit === fit
                ? "bg-white/15 text-white"
                : "text-zinc-400"
            }`}
          >
            {fit}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-[11px] text-zinc-500">
        Opacity {Math.round(slide.background.imageOpacity * 100)}%
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={slide.background.imageOpacity}
          onChange={(event) =>
            updateSlide(slide.id, {
              background: {
                ...slide.background,
                imageOpacity: Number(event.target.value),
              },
            })
          }
          style={rangeFillStyle(slide.background.imageOpacity, 0.2, 1)}
          className="range-thin mt-1.5 w-full"
        />
      </label>
      {slide.background.imageId && assetUrls[slide.background.imageId] ? (
        <img
          src={assetUrls[slide.background.imageId]}
          alt=""
          className="mt-3 h-20 w-full rounded-lg object-cover ring-1 ring-white/10"
        />
      ) : null}
    </>
  )
}

function PropertyAccordion({
  defaultOpen,
  children,
}: {
  defaultOpen: string
  children: ReactNode
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpen)
  return (
    <PropertyAccordionContext.Provider value={{ openId, setOpenId }}>
      {children}
    </PropertyAccordionContext.Provider>
  )
}

const PropertyAccordionContext = createContext<{
  openId: string | null
  setOpenId: (id: string | null) => void
} | null>(null)

function PropertySection({
  id,
  title,
  children,
  copySection,
}: {
  id: string
  title: string
  children: ReactNode
  /** When set, shows Copy for all fields in this inspector section. */
  copySection?: PropertySectionId
}) {
  const accordion = useContext(PropertyAccordionContext)
  const propertyCopy = useContext(PropertyCopyContext)
  const open = accordion ? accordion.openId === id : false
  return (
    <div className="border-b border-white/[0.06]/90">
      <div className="flex items-center gap-1 py-2.5">
        <button
          type="button"
          onClick={() => accordion?.setOpenId(open ? null : id)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            {title}
          </span>
          <svg
            viewBox="0 0 12 12"
            className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            <path
              d="M2.5 4.25 6 7.75l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {copySection && propertyCopy ? (
          <CopyPropButton
            title={`Copy ${title} section`}
            onClick={() => propertyCopy.copySection(copySection)}
          />
        ) : null}
      </div>
      {open ? <div className="flex flex-col gap-3 pb-3">{children}</div> : null}
    </div>
  )
}

function ActionRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-white/[0.06] pt-3">
      {children}
    </div>
  )
}

function CopyToSlideControl({
  kind,
  sourceSlideId,
  componentId,
  slides,
  onCopy,
}: {
  kind: SelectedKind
  sourceSlideId: string
  componentId: string
  slides: Slide[]
  onCopy: (
    sourceSlideId: string,
    componentId: string,
    targetSlideId: string,
  ) => void
}) {
  const options = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide.id !== sourceSlideId)
  if (options.length === 0) return null

  return (
    <label className={`relative ${ACTION_BTN} cursor-pointer`}>
      <span className="pointer-events-none flex items-center gap-1">
        Copy to…
        <svg
          viewBox="0 0 12 12"
          className="h-2.5 w-2.5 text-zinc-500"
          aria-hidden
        >
          <path
            d="M2.5 4.25 6 7.75l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="sr-only">Copy to slide</span>
      <select
        className="absolute inset-0 cursor-pointer opacity-0"
        defaultValue=""
        onChange={(event) => {
          const targetId = event.target.value
          if (!targetId) return
          onCopy(sourceSlideId, componentId, targetId)
          event.target.value = ""
        }}
      >
        <option value="" disabled>
          Copy to…
        </option>
        {options.map(({ slide, index }) => {
          const enabled = canCopyComponentToSlide(kind, slide)
          return (
            <option key={slide.id} value={slide.id} disabled={!enabled}>
              Slide {index + 1}
              {enabled ? "" : " (full)"}
            </option>
          )
        })}
      </select>
    </label>
  )
}

function normalizeHexColor(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((ch) => ch + ch)
        .join("")
    }
    return `#${hex.toLowerCase()}`
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i,
  )
  if (rgbMatch) {
    const channels = rgbMatch.slice(1, 4).map((part) => {
      const n = Math.min(255, Math.max(0, Number(part)))
      return n.toString(16).padStart(2, "0")
    })
    return `#${channels.join("")}`
  }

  return null
}

function ColorField({
  label,
  value,
  onChange,
  copyKey,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  /** Also copy this property into the in-app property clipboard. */
  copyKey?: keyof SelectionPatch
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const propertyCopy = useContext(PropertyCopyContext)
  const display = draft ?? value

  const commit = (raw: string) => {
    const next = normalizeHexColor(raw)
    setDraft(null)
    if (next) onChange(next)
  }

  const copyColor = async () => {
    const hex = normalizeHexColor(draft ?? value) ?? value
    if (copyKey && propertyCopy) {
      propertyCopy.copyField(copyKey, label)
    }
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      if (copyKey && propertyCopy) {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }
    }
  }

  return (
    <label className="flex-1 text-[11px] text-zinc-500">
      {label}
      <span className="mt-1 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0a0a0e] px-2 py-1.5">
        <input
          type="color"
          value={normalizeHexColor(value) ?? "#000000"}
          onChange={(event) => {
            setDraft(null)
            onChange(event.target.value)
          }}
          className="h-6 w-6 shrink-0 cursor-pointer"
          aria-label={`${label} swatch`}
        />
        <input
          type="text"
          spellCheck={false}
          value={display}
          onFocus={() => setDraft(value)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text")
            const next = normalizeHexColor(pasted)
            if (!next) return
            event.preventDefault()
            setDraft(null)
            onChange(next)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit((event.target as HTMLInputElement).value)
              ;(event.target as HTMLInputElement).blur()
            }
            if (event.key === "Escape") {
              setDraft(null)
              ;(event.target as HTMLInputElement).blur()
            }
          }}
          className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600"
          placeholder="#ffffff"
          aria-label={`${label} hex`}
        />
        <button
          type="button"
          title={copied ? "Copied" : "Copy color"}
          aria-label={copied ? "Copied" : `Copy ${label}`}
          onClick={(event) => {
            event.preventDefault()
            void copyColor()
          }}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </span>
    </label>
  )
}

function MultiSelectionProperties({
  count,
  primary,
  kind,
  selectedIds,
  project,
  patchSelectionCommon,
  scaleSelectionRelative,
  alignSelection,
  moveSelectionByArtboardDelta,
  deleteSelection,
  groupSelection,
  ungroupSelection,
}: {
  count: number
  primary: Frame | TextLayer | ClipartLayer | LensLayer | null
  kind: SelectedKind
  selectedIds: string[]
  project: import("../types").Project
  patchSelectionCommon: (patch: SelectionPatch) => void
  scaleSelectionRelative: (factor: number) => void
  alignSelection: (patch: { x?: number; y?: number }) => void
  moveSelectionByArtboardDelta: (
    origins: ReturnType<typeof selectionMoveOrigins>,
    dx: number,
    dy: number,
  ) => void
  deleteSelection: () => void
  groupSelection: () => void
  ungroupSelection: () => void
}) {
  const layers = resolveSelectedLayers(project, selectedIds)
  const uniform = uniformSelectionKind(layers)
  const activeSlide =
    project.slides.find((slide) => slide.id === project.activeSlideId) ??
    project.slides[0]
  const showGroup = canGroupSelection(activeSlide, selectedIds)
  const showUngroup = canUngroupSelection(activeSlide, selectedIds)
  const target = STORE_TARGETS[project.targetId]
  const landscapeArtboard = target.orientation === "landscape"
  const deviceOptions = (Object.keys(DEVICES) as DeviceId[]).filter((id) =>
    landscapeArtboard ? id.endsWith("-land") : !id.endsWith("-land"),
  )

  const framePrimary =
    uniform === "frame" && primary && "scale" in primary
      ? (primary as Frame)
      : null
  const textPrimary =
    uniform === "text" && primary && "content" in primary
      ? (primary as TextLayer)
      : null
  const clipartPrimary =
    uniform === "clipart" && primary && "assetId" in primary
      ? (primary as ClipartLayer)
      : null
  const lensPrimary =
    uniform === "lens" && primary && "zoom" in primary
      ? (primary as LensLayer)
      : null

  const fitScale = framePrimary
    ? maxFittingDeviceScale(framePrimary.deviceId, target.width, target.height)
    : 1

  const x = primary && "x" in primary ? primary.x : 50
  const y = primary && "y" in primary ? primary.y : 50
  const rotation = primary && "rotation" in primary ? primary.rotation : 0
  const flipH = Boolean(primary && "flipH" in primary && primary.flipH)
  const flipV = Boolean(primary && "flipV" in primary && primary.flipV)
  const shadow = {
    shadow: primary && "shadow" in primary ? primary.shadow : 0,
    shadowOffsetX:
      primary && "shadowOffsetX" in primary ? primary.shadowOffsetX : 0,
    shadowOffsetY:
      primary && "shadowOffsetY" in primary ? primary.shadowOffsetY : 0,
    shadowOpacity:
      primary && "shadowOpacity" in primary ? primary.shadowOpacity : 55,
  }

  const nudgeGroup = (dx: number, dy: number) => {
    const origins = selectionMoveOrigins(project, selectedIds)
    moveSelectionByArtboardDelta(origins, dx, dy)
  }

  const kindLabel =
    uniform === "frame"
      ? "phones"
      : uniform === "text"
        ? "text layers"
        : uniform === "clipart"
          ? "cliparts"
          : uniform === "lens"
            ? "lenses"
            : "mixed layers"

  const body = (
    <div className="space-y-1 pb-4">
      <p className="px-1 py-2 text-[11px] leading-relaxed text-zinc-500">
        Editing {count} {kindLabel}
        {uniform
          ? ". All shared properties for this type apply to every selected item."
          : ". Only properties shared across different types are shown."}
      </p>

      <PropertyAccordion defaultOpen="multi-position">
        <PropertySection
          id="multi-position"
          title="Position"
          copySection={primary ? "position" : undefined}
        >
          <PositionAlignControls
            x={x}
            y={y}
            onChange={(patch) => alignSelection(patch)}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[11px] text-zinc-500">
              X (primary)
              <input
                type="number"
                value={Math.round(x * 10) / 10}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isFinite(next)) return
                  nudgeGroup(next - x, 0)
                }}
                className="mt-1 w-full rounded-md border border-white/10 bg-[#0a0a0e] px-2 py-1.5 text-xs text-zinc-200"
              />
            </label>
            <label className="text-[11px] text-zinc-500">
              Y (primary)
              <input
                type="number"
                value={Math.round(y * 10) / 10}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isFinite(next)) return
                  nudgeGroup(0, next - y)
                }}
                className="mt-1 w-full rounded-md border border-white/10 bg-[#0a0a0e] px-2 py-1.5 text-xs text-zinc-200"
              />
            </label>
          </div>
        </PropertySection>

        {framePrimary ? (
          <PropertySection id="multi-device" title="Device">
            <div className="grid grid-cols-1 gap-1.5">
              {deviceOptions.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patchSelectionCommon({ deviceId: id })}
                  className={`rounded-md px-2 py-1.5 text-left text-xs ${
                    framePrimary.deviceId === id
                      ? "bg-[#e8ff47] text-[#0a0a0c]"
                      : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {DEVICES[id].name}
                </button>
              ))}
            </div>
          </PropertySection>
        ) : null}

        {textPrimary ? (
          <PropertySection id="multi-content" title="Content">
            <label className="block text-[11px] text-zinc-500">
              Font
              <select
                value={textPrimary.font}
                onChange={(event) =>
                  patchSelectionCommon({ font: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a0a0e] px-2.5 py-2 text-sm text-white outline-none"
              >
                {FONTS.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] text-zinc-500">
              Size
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={textPrimary.size}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    if (!Number.isFinite(next)) return
                    patchSelectionCommon({ size: Math.max(1, Math.round(next)) })
                  }}
                  className="w-full rounded-md border border-white/10 bg-[#0a0a0e] px-2 py-1.5 font-mono text-xs text-zinc-200"
                />
                <span className="shrink-0 text-[10px] text-zinc-600">px</span>
              </div>
            </label>
            <RangeValueField
              label="Box width"
              suffix="%"
              min={10}
              max={120}
              step={1}
              value={textPrimary.width}
              onChange={(value) => patchSelectionCommon({ width: value })}
            />
            <ColorField
              label="Color"
              value={textPrimary.color}
              onChange={(value) => patchSelectionCommon({ color: value })}
            />
            <label className="block text-[11px] text-zinc-500">
              Weight
              <select
                value={textPrimary.weight}
                onChange={(event) =>
                  patchSelectionCommon({
                    weight: Number(event.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a0a0e] px-2.5 py-2 text-sm text-white outline-none"
              >
                {[400, 500, 600, 700, 800].map((weight) => (
                  <option key={weight} value={weight}>
                    {weight}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-1.5 text-[11px] text-zinc-500">Align</p>
              <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => patchSelectionCommon({ align })}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] capitalize ${
                      textPrimary.align === align
                        ? "bg-[#e8ff47] text-[#0a0a0c]"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>
          </PropertySection>
        ) : null}

        <PropertySection
          id="multi-transform"
          title="Transform"
          copySection={primary ? "transform" : undefined}
        >
          {framePrimary ? (
            <RangeValueField
              label="Scale"
              suffix="%"
              min={40}
              max={110}
              step={1}
              value={Math.min(
                110,
                Math.max(40, Math.round((framePrimary.scale / fitScale) * 100)),
              )}
              onChange={(value) =>
                patchSelectionCommon({
                  scale: (value / 100) * fitScale,
                })
              }
            />
          ) : null}
          {clipartPrimary ? (
            <RangeValueField
              label="Scale"
              suffix="%"
              min={CLIPART_WIDTH_MIN}
              max={CLIPART_WIDTH_MAX}
              step={1}
              value={Math.round(clipartPrimary.width)}
              onChange={(value) => patchSelectionCommon({ width: value })}
            />
          ) : null}
          {lensPrimary ? (
            <>
              <RangeValueField
                label="Width"
                suffix="%"
                min={6}
                max={100}
                step={1}
                value={lensPrimary.width}
                onChange={(value) => patchSelectionCommon({ width: value })}
              />
              <RangeValueField
                label="Height"
                suffix="%"
                min={6}
                max={100}
                step={1}
                value={lensPrimary.height}
                onChange={(value) => patchSelectionCommon({ height: value })}
              />
              <RangeValueField
                label="Zoom"
                suffix="×"
                min={1.25}
                max={4}
                step={0.05}
                value={lensPrimary.zoom}
                onChange={(value) => patchSelectionCommon({ zoom: value })}
              />
            </>
          ) : null}
          {uniform ? (
            <>
              <RangeValueField
                label="Tilt X"
                suffix="°"
                min={-45}
                max={45}
                step={1}
                value={
                  (primary && "rotationX" in primary
                    ? primary.rotationX
                    : 0) ?? 0
                }
                onChange={(value) =>
                  patchSelectionCommon({ rotationX: value })
                }
              />
              <RangeValueField
                label="Tilt Y"
                suffix="°"
                min={-45}
                max={45}
                step={1}
                value={
                  (primary && "rotationY" in primary
                    ? primary.rotationY
                    : 0) ?? 0
                }
                onChange={(value) =>
                  patchSelectionCommon({ rotationY: value })
                }
              />
            </>
          ) : null}
          <RangeValueField
            label="Spin"
            suffix="°"
            min={-180}
            max={180}
            step={1}
            value={rotation}
            onChange={(value) => patchSelectionCommon({ rotation: value })}
          />
          <div>
            <p className="mb-1.5 text-[11px] text-zinc-500">
              Scale all (relative)
            </p>
            <div className="flex gap-1">
              {[0.9, 0.95, 1.05, 1.1].map((factor) => (
                <button
                  key={factor}
                  type="button"
                  onClick={() => scaleSelectionRelative(factor)}
                  className="flex-1 rounded-md bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  {factor < 1 ? "−" : "+"}
                  {Math.round(Math.abs(factor - 1) * 100)}%
                </button>
              ))}
            </div>
          </div>
          <FlipControls
            flipH={flipH}
            flipV={flipV}
            onChange={(patch) => patchSelectionCommon(patch)}
          />
        </PropertySection>

        {textPrimary ? (
          <PropertySection id="multi-style" title="Style" copySection="style">
            <RangeValueField
              label="Outline"
              suffix="px"
              min={0}
              max={24}
              step={1}
              value={textPrimary.strokeWidth ?? 0}
              onChange={(value) =>
                patchSelectionCommon({ strokeWidth: value })
              }
            />
            {(textPrimary.strokeWidth ?? 0) > 0 ? (
              <ColorField
                label="Outline color"
                value={textPrimary.strokeColor || "#000000"}
                onChange={(value) =>
                  patchSelectionCommon({ strokeColor: value })
                }
              />
            ) : null}
          </PropertySection>
        ) : null}

        {clipartPrimary ? (
          <PropertySection id="multi-style" title="Style" copySection="style">
            <RangeValueField
              label="Opacity"
              suffix="%"
              min={0}
              max={100}
              step={1}
              value={Math.round((clipartPrimary.opacity ?? 1) * 100)}
              onChange={(value) =>
                patchSelectionCommon({ opacity: value / 100 })
              }
            />
            <RangeValueField
              label="Blur"
              suffix="px"
              min={0}
              max={48}
              step={1}
              value={clipartPrimary.blur ?? 0}
              onChange={(value) => patchSelectionCommon({ blur: value })}
            />
            <div>
              <p className="mb-1.5 text-[11px] text-zinc-500">Recolor</p>
              <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
                {(
                  [
                    ["off", "Original"],
                    ["solid", "Solid"],
                    ["gradient", "Gradient"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => patchSelectionCommon({ recolor: mode })}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] ${
                      (clipartPrimary.recolor ?? "off") === mode
                        ? "bg-[#e8ff47] text-[#0a0a0c]"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {(clipartPrimary.recolor ?? "off") !== "off" ? (
              <div className="flex flex-col gap-2">
                <ColorField
                  label={
                    (clipartPrimary.recolor ?? "off") === "gradient"
                      ? "Color A"
                      : "Color"
                  }
                  value={clipartPrimary.color ?? "#fbbf24"}
                  onChange={(value) => patchSelectionCommon({ color: value })}
                />
                {(clipartPrimary.recolor ?? "off") === "gradient" ? (
                  <ColorField
                    label="Color B"
                    value={clipartPrimary.color2 ?? "#f97316"}
                    onChange={(value) =>
                      patchSelectionCommon({ color2: value })
                    }
                  />
                ) : null}
              </div>
            ) : null}
            {(clipartPrimary.recolor ?? "off") === "gradient" ? (
              <RangeValueField
                label="Gradient angle"
                suffix="°"
                min={0}
                max={360}
                step={1}
                value={clipartPrimary.colorAngle ?? 135}
                onChange={(value) =>
                  patchSelectionCommon({ colorAngle: value })
                }
              />
            ) : null}
          </PropertySection>
        ) : null}

        {lensPrimary ? (
          <PropertySection id="multi-style" title="Style" copySection="style">
            <RangeValueField
              label="Corner roundness"
              suffix="%"
              min={0}
              max={50}
              step={1}
              value={lensPrimary.cornerRadius}
              onChange={(value) =>
                patchSelectionCommon({ cornerRadius: value })
              }
            />
            <RangeValueField
              label="Border"
              suffix="px"
              min={0}
              max={160}
              step={1}
              value={lensPrimary.borderWidth}
              onChange={(value) =>
                patchSelectionCommon({ borderWidth: value })
              }
            />
            <ColorField
              label="Border color"
              value={lensPrimary.borderColor}
              onChange={(value) =>
                patchSelectionCommon({ borderColor: value })
              }
            />
          </PropertySection>
        ) : null}

        <ShadowSection
          value={shadow}
          softSize={
            textPrimary
              ? Math.max(12, textPrimary.size * 0.18)
              : framePrimary
                ? 24
                : 18
          }
          blurMax={textPrimary ? 48 : 80}
          onChange={(patch) => patchSelectionCommon(patch)}
        />
      </PropertyAccordion>

      <ActionRow>
        <PastePropertiesAction
          targetKind={kind}
          onPaste={(patch) => patchSelectionCommon(patch)}
        />
        {showGroup ? (
          <button
            type="button"
            className={ACTION_BTN}
            onClick={() => groupSelection()}
            title="Group (⌘/Ctrl+G)"
          >
            Group
          </button>
        ) : null}
        {showUngroup ? (
          <button
            type="button"
            className={ACTION_BTN}
            onClick={() => ungroupSelection()}
            title="Ungroup (⌘/Ctrl+Shift+G)"
          >
            Ungroup
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => deleteSelection()}
          className={`${ACTION_BTN_DANGER} col-span-2`}
        >
          Delete {count} layers
        </button>
      </ActionRow>
    </div>
  )

  if (!primary) return body
  return (
    <PropertyCopyProvider kind={kind} layer={primary}>
      {body}
    </PropertyCopyProvider>
  )
}

function PositionAlignControls({
  x,
  y,
  onChange,
  mode = "slide",
  className = "",
}: {
  x: number
  y: number
  onChange: (patch: { x?: number; y?: number }) => void
  /** Attached cliparts use device-relative coords around 0. */
  mode?: "slide" | "attached"
  className?: string
}) {
  const snapX =
    mode === "attached"
      ? ({ left: -55, center: 0, right: 55 } as const)
      : ({ left: 20, center: 50, right: 80 } as const)
  const snapY =
    mode === "attached"
      ? ({ top: -40, middle: 0, bottom: 45 } as const)
      : ({ top: 15, middle: 50, bottom: 85 } as const)
  const min = mode === "attached" ? -160 : -30
  const max = mode === "attached" ? 160 : 130

  const cells: {
    key: string
    label: string
    nx: number
    ny: number
  }[] = [
    { key: "tl", label: "Top left", nx: snapX.left, ny: snapY.top },
    { key: "tc", label: "Top", nx: snapX.center, ny: snapY.top },
    { key: "tr", label: "Top right", nx: snapX.right, ny: snapY.top },
    { key: "ml", label: "Left", nx: snapX.left, ny: snapY.middle },
    { key: "mc", label: "Center", nx: snapX.center, ny: snapY.middle },
    { key: "mr", label: "Right", nx: snapX.right, ny: snapY.middle },
    { key: "bl", label: "Bottom left", nx: snapX.left, ny: snapY.bottom },
    { key: "bc", label: "Bottom", nx: snapX.center, ny: snapY.bottom },
    { key: "br", label: "Bottom right", nx: snapX.right, ny: snapY.bottom },
  ]

  const near = (a: number, b: number) => Math.abs(a - b) < 1.5

  return (
    <div className={className}>
      <p className="mb-1.5 text-[11px] text-zinc-500">
        Position{mode === "attached" ? " (on phone)" : ""}
      </p>
      <div className="mb-2 grid grid-cols-3 gap-1">
        {cells.map((cell) => {
          const active = near(x, cell.nx) && near(y, cell.ny)
          return (
            <button
              key={cell.key}
              type="button"
              title={cell.label}
              aria-label={cell.label}
              onClick={() => onChange({ x: cell.nx, y: cell.ny })}
              className={`flex h-8 items-center justify-center rounded-md ${
                active
                  ? "bg-[#e8ff47] text-[#0a0a0c]"
                  : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  active ? "bg-white" : "bg-zinc-500"
                }`}
              />
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RangeValueField
          label="X"
          suffix="%"
          min={min}
          max={max}
          step={1}
          value={Math.round(x)}
          copyKey="x"
          onChange={(value) => onChange({ x: value })}
        />
        <RangeValueField
          label="Y"
          suffix="%"
          min={min}
          max={max}
          step={1}
          value={Math.round(y)}
          copyKey="y"
          onChange={(value) => onChange({ y: value })}
        />
      </div>
    </div>
  )
}

function rangeFillStyle(
  value: number,
  min: number,
  max: number,
): import("react").CSSProperties {
  const span = max - min
  const pct =
    span <= 0
      ? 0
      : ((Math.min(max, Math.max(min, value)) - min) / span) * 100
  return { ["--range-fill"]: `${pct}%` } as import("react").CSSProperties
}

function FlipControls({
  flipH,
  flipV,
  onChange,
}: {
  flipH?: boolean
  flipV?: boolean
  onChange: (patch: { flipH?: boolean; flipV?: boolean }) => void
}) {
  const h = Boolean(flipH)
  const v = Boolean(flipV)
  return (
    <div>
      <p className="mb-1.5 text-[11px] text-zinc-500">Flip</p>
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
        <button
          type="button"
          aria-pressed={h}
          onClick={() => onChange({ flipH: !h })}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            h
              ? "bg-[#e8ff47] text-[#0a0a0c]"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          Horizontal
        </button>
        <button
          type="button"
          aria-pressed={v}
          onClick={() => onChange({ flipV: !v })}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            v
              ? "bg-[#e8ff47] text-[#0a0a0c]"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          Vertical
        </button>
      </div>
    </div>
  )
}

type ShadowFields = {
  shadow?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowOpacity?: number
}

/** Dedicated accordion section — shared by device, text, clipart, lens. */
function ShadowSection({
  value,
  softSize = 18,
  blurMax = 80,
  onChange,
}: {
  value: ShadowFields
  /** Soft preset base size (px). */
  softSize?: number
  blurMax?: number
  onChange: (patch: ShadowFields) => void
}) {
  const blur = value.shadow ?? 0
  const ox = value.shadowOffsetX ?? 0
  const oy = value.shadowOffsetY ?? 0
  const opacity = value.shadowOpacity ?? 55
  const hasShadow = blur > 0 || ox !== 0 || oy !== 0

  return (
    <PropertySection id="shadow" title="Shadow" copySection="shadow">
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
        {(
          [
            ["none", "None"],
            ["soft", "Soft"],
            ["hard", "Hard"],
          ] as const
        ).map(([id, label]) => {
          const active =
            id === "none"
              ? !hasShadow
              : id === "hard"
                ? blur <= 0 && (ox !== 0 || oy !== 0)
                : blur > 0
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(deviceShadowPreset(id, softSize))}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] ${
                active
                  ? "bg-[#e8ff47] text-[#0a0a0c]"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
      {hasShadow ? (
        <>
          <RangeValueField
            label="Blur"
            suffix="px"
            min={0}
            max={blurMax}
            step={1}
            value={blur}
            copyKey="shadow"
            onChange={(next) =>
              onChange({
                shadow: next,
                shadowOpacity: opacity > 0 ? opacity : 55,
              })
            }
          />
          <RangeValueField
            label="Offset X"
            suffix="px"
            min={-40}
            max={40}
            step={1}
            value={ox}
            copyKey="shadowOffsetX"
            onChange={(next) =>
              onChange({
                shadowOffsetX: next,
                shadowOpacity: opacity > 0 ? opacity : 70,
              })
            }
          />
          <RangeValueField
            label="Offset Y"
            suffix="px"
            min={-40}
            max={40}
            step={1}
            value={oy}
            copyKey="shadowOffsetY"
            onChange={(next) =>
              onChange({
                shadowOffsetY: next,
                shadowOpacity: opacity > 0 ? opacity : 70,
              })
            }
          />
          <RangeValueField
            label="Opacity"
            suffix="%"
            min={0}
            max={100}
            step={1}
            value={opacity}
            copyKey="shadowOpacity"
            onChange={(next) => onChange({ shadowOpacity: next })}
          />
        </>
      ) : null}
    </PropertySection>
  )
}

function RangeValueField({
  label,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
  className = "",
  copyKey,
}: {
  label: string
  suffix?: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  className?: string
  copyKey?: keyof SelectionPatch
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const propertyCopy = useContext(PropertyCopyContext)
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  const display = draft ?? String(value)
  const clamped = clamp(value)

  const commit = (raw: string) => {
    const parsed = Number(raw)
    setDraft(null)
    if (!Number.isFinite(parsed)) return
    onChange(clamp(parsed))
  }

  return (
    <div className={`block text-[11px] text-zinc-500 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <span>{label}</span>
          {copyKey && propertyCopy ? (
            <CopyPropButton
              title={`Copy ${label}`}
              onClick={() => propertyCopy.copyField(copyKey, label)}
            />
          ) : null}
        </span>
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={display}
            onFocus={() => setDraft(String(value))}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commit((event.target as HTMLInputElement).value)
                ;(event.target as HTMLInputElement).blur()
              }
            }}
            className="w-14 rounded border border-white/10 bg-[#0a0a0e] px-1.5 py-0.5 text-right font-mono text-[11px] text-zinc-200 outline-none focus:border-[#e8ff47]/50"
          />
          {suffix ? <span className="text-zinc-500">{suffix}</span> : null}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        onChange={(event) => {
          setDraft(null)
          onChange(Number(event.target.value))
        }}
        style={rangeFillStyle(clamped, min, max)}
        className="range-thin mt-1.5 w-full"
      />
    </div>
  )
}
