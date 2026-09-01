"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  deleteLibraryBackground,
  deleteLibraryClipart,
  deleteDemoScreen,
  deleteTemplate,
  listAllBackgrounds,
  listAllCliparts,
  listAllTemplates,
  listDemoScreens,
  listProjects,
  publishDemoScreens,
  publishProjectAsTemplate,
  createProject,
  upsertLibraryBackground,
  upsertLibraryClipart,
  upsertTemplate,
} from "../api/projects"
import {
  generateClipartPreview,
  pngBase64ToFile,
} from "../api/generate-clipart"
import {
  generateMediaPreview,
  type DemoAspect,
} from "../api/generate-media"
import { analyzeStoreLayout } from "../api/analyze-store-layout"
import { importStoreApp } from "../api/import-store-app"
import { buildProjectFromStoreAnalysis } from "../import-store-project"
import { useAuth } from "../auth/AuthProvider"
import { createSampleProject } from "../constants"
import { IMAGE_ACCEPT, isImageFile, normalizeImageFile } from "../image-upload"
import { renderTemplatePreviewDataUrl } from "../template-preview"
import type {
  LibraryBackgroundRecord,
  LibraryClipartRecord,
  LibraryDemoScreenRecord,
  ProjectRecord,
  TemplateRecord,
} from "../types/cloud"
import { TemplateThumbnail } from "../components/TemplateThumbnail"

type AdminTab = "templates" | "clipart" | "demos" | "backgrounds"

export function AdminPage() {
  const { ready, userId, isAdmin, usingLocalBackend } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>("templates")
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [cliparts, setCliparts] = useState<LibraryClipartRecord[]>([])
  const [demos, setDemos] = useState<LibraryDemoScreenRecord[]>([])
  const [backgrounds, setBackgrounds] = useState<LibraryBackgroundRecord[]>([])
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [genPrompt, setGenPrompt] = useState("")
  const [genName, setGenName] = useState("")
  const [genCategory, setGenCategory] = useState("general")
  const [genPreviewBase64, setGenPreviewBase64] = useState<string | null>(null)
  const [genPreviewMime, setGenPreviewMime] = useState("image/webp")
  const [genBusy, setGenBusy] = useState(false)
  const [demoPrompt, setDemoPrompt] = useState("")
  const [demoName, setDemoName] = useState("")
  const [demoAspect, setDemoAspect] = useState<DemoAspect>("iphone")
  const [demoPreviews, setDemoPreviews] = useState<
    { imageBase64: string; mime: string }[]
  >([])
  const [demoBusy, setDemoBusy] = useState(false)
  const [bgPrompt, setBgPrompt] = useState("")
  const [bgName, setBgName] = useState("")
  const [bgPreviewBase64, setBgPreviewBase64] = useState<string | null>(null)
  const [bgPreviewMime, setBgPreviewMime] = useState("image/webp")
  const [bgBusy, setBgBusy] = useState(false)
  const [storeQuery, setStoreQuery] = useState("")
  const [storeBusy, setStoreBusy] = useState(false)
  const [storeImport, setStoreImport] = useState<{
    projectId: string
    title: string
    description: string
    screenshotCount: number
    store: "apple" | "google"
  } | null>(null)

  const reload = async () => {
    const [t, c, p, d, b] = await Promise.all([
      listAllTemplates(),
      listAllCliparts(),
      listProjects(),
      listDemoScreens().catch(() => [] as LibraryDemoScreenRecord[]),
      listAllBackgrounds().catch(() => [] as LibraryBackgroundRecord[]),
    ])
    setTemplates(t)
    setCliparts(c)
    setProjects(p)
    setDemos(d)
    setBackgrounds(b)
  }

  useEffect(() => {
    if (!isAdmin) return
    void reload().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load admin data"),
    )
  }, [isAdmin])

  useEffect(() => {
    if (ready && !userId) router.replace("/login")
  }, [ready, userId, router])

  if (ready && !userId) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-zinc-400">
        Redirecting…
      </div>
    )
  }
  if (ready && !isAdmin) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#07070a] text-sm text-zinc-400">
        Admin only.{usingLocalBackend ? " Sign in as you@admin.local" : null}
      </div>
    )
  }

  const onPublishFromProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const formEl = event.currentTarget
    const form = new FormData(formEl)
    const projectId = String(form.get("projectId") || "")
    const title = String(form.get("title") || "").trim()
    const description = String(form.get("description") || "").trim()
    if (!projectId) {
      setError("Pick a project to publish")
      return
    }
    setBusy(true)
    try {
      const published = await publishProjectAsTemplate({
        projectId,
        title,
        description,
        published: true,
      })
      setMessage(`Template “${published.title}” published`)
      formEl.reset()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed")
    } finally {
      setBusy(false)
    }
  }

  const publishFromCurrentSample = async () => {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const sample = createSampleProject()
      await upsertTemplate({
        slug: `template-${Date.now()}`,
        title: sample.name,
        description: "Built-in sample layout",
        preview_path: await renderTemplatePreviewDataUrl(sample),
        data: sample,
        sort_order: templates.length,
        published: true,
      })
      setMessage("Sample template published")
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  const onClipartUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const formEl = event.currentTarget
    const form = new FormData(formEl)
    const name = String(form.get("name") || "Clipart")
    const category = String(form.get("category") || "general")
    const file = form.get("file")
    if (!(file instanceof File) || !file.size || !isImageFile(file)) {
      setError("Choose an image file (PNG, JPEG, WebP, or HEIC)")
      return
    }
    try {
      const normalized = await normalizeImageFile(file)
      await upsertLibraryClipart({
        name,
        category,
        sort_order: cliparts.length,
        published: true,
        file: normalized,
      })
      setMessage("Clipart added")
      formEl.reset()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    }
  }

  const onGenerateClipart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setGenBusy(true)
    setGenPreviewBase64(null)
    try {
      const result = await generateClipartPreview({
        prompt: genPrompt,
        name: genName || undefined,
      })
      setGenPreviewBase64(result.imageBase64 || result.pngBase64)
      setGenPreviewMime(result.mime || "image/webp")
      if (result.name && !genName.trim()) setGenName(result.name)
      setMessage("Preview ready — publish to add it to the library.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setGenBusy(false)
    }
  }

  const onPublishGeneratedClipart = async () => {
    if (!genPreviewBase64) return
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const ext = genPreviewMime.includes("webp")
        ? "webp"
        : genPreviewMime.includes("jpeg") || genPreviewMime.includes("jpg")
          ? "jpg"
          : "png"
      const file = pngBase64ToFile(
        genPreviewBase64,
        `${(genName || "clipart").replace(/[^\w.\-]+/g, "_")}.${ext}`,
        genPreviewMime,
      )
      await upsertLibraryClipart({
        name: genName.trim() || genPrompt.trim().slice(0, 40) || "Clipart",
        category: genCategory.trim() || "general",
        sort_order: cliparts.length,
        published: true,
        file,
      })
      setMessage("Generated clipart published")
      setGenPreviewBase64(null)
      setGenPreviewMime("image/webp")
      setGenPrompt("")
      setGenName("")
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed")
    } finally {
      setBusy(false)
    }
  }

  const onGenerateDemos = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setDemoBusy(true)
    setDemoPreviews([])
    try {
      const result = await generateMediaPreview({
        kind: "demo",
        prompt: demoPrompt,
        name: demoName || undefined,
        aspect: demoAspect,
      })
      setDemoPreviews(
        result.images.map((img) => ({
          imageBase64: img.imageBase64,
          mime: img.mime,
        })),
      )
      if (result.name && !demoName.trim()) setDemoName(result.name)
      setMessage(
        `${result.images.length} demo screens ready — publish to save (admin-only).`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setDemoBusy(false)
    }
  }

  const onPublishDemos = async () => {
    if (!demoPreviews.length) return
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const baseName =
        demoName.trim() || demoPrompt.trim().slice(0, 40) || "App demo"
      const files = demoPreviews.map((img, i) => {
        const ext = img.mime.includes("webp") ? "webp" : "png"
        return pngBase64ToFile(
          img.imageBase64,
          `${baseName.replace(/[^\w.\-]+/g, "_")}-${i + 1}.${ext}`,
          img.mime,
        )
      })
      await publishDemoScreens({
        name: baseName,
        prompt: demoPrompt.trim(),
        aspect: demoAspect,
        files,
      })
      setMessage("Demo screens published (visible to admins only)")
      setDemoPreviews([])
      setDemoPrompt("")
      setDemoName("")
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed")
    } finally {
      setBusy(false)
    }
  }

  const onGenerateBackground = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setBgBusy(true)
    setBgPreviewBase64(null)
    try {
      const result = await generateMediaPreview({
        kind: "background",
        prompt: bgPrompt,
        name: bgName || undefined,
      })
      const first = result.images[0]
      if (!first) throw new Error("No image returned")
      setBgPreviewBase64(first.imageBase64)
      setBgPreviewMime(first.mime)
      if (result.name && !bgName.trim()) setBgName(result.name)
      setMessage("Background preview ready — publish for all users.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setBgBusy(false)
    }
  }

  const onPublishBackground = async () => {
    if (!bgPreviewBase64) return
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const ext = bgPreviewMime.includes("webp") ? "webp" : "png"
      const file = pngBase64ToFile(
        bgPreviewBase64,
        `${(bgName || "background").replace(/[^\w.\-]+/g, "_")}.${ext}`,
        bgPreviewMime,
      )
      await upsertLibraryBackground({
        name: bgName.trim() || bgPrompt.trim().slice(0, 40) || "Background",
        prompt: bgPrompt.trim(),
        sort_order: backgrounds.length,
        published: true,
        file,
      })
      setMessage("Background published for all users")
      setBgPreviewBase64(null)
      setBgPreviewMime("image/webp")
      setBgPrompt("")
      setBgName("")
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed")
    } finally {
      setBusy(false)
    }
  }

  const onImportFromStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setStoreBusy(true)
    setStoreImport(null)
    try {
      setMessage("Importing listing & analyzing layouts…")
      const listing = await importStoreApp({ query: storeQuery })
      let layouts = listing.layouts ?? []
      if (layouts.length !== listing.assetIds.length) {
        // Older function deploy or missing OPENAI key — fall back once.
        setMessage(
          `Finishing analysis for ${listing.assetIds.length} screens…`,
        )
        const analyzed = await analyzeStoreLayout({
          assetIds: listing.assetIds,
        })
        layouts = analyzed.layouts
      }
      setMessage("Building editable project…")
      const project = await buildProjectFromStoreAnalysis({
        title: listing.title,
        store: listing.store,
        orientation: listing.orientation,
        assetIds: listing.assetIds,
        layouts,
      })
      const record = await createProject(project)
      setStoreImport({
        projectId: record.id,
        title: listing.title,
        description: listing.description,
        screenshotCount: listing.assetIds.length,
        store: listing.store,
      })
      setMessage(
        `Imported “${listing.title}” (${listing.assetIds.length} screens as editable components). Open to tweak or publish.`,
      )
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Store import failed")
      setMessage(null)
    } finally {
      setStoreBusy(false)
    }
  }

  const onPublishImportedTemplate = async () => {
    if (!storeImport) return
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const published = await publishProjectAsTemplate({
        projectId: storeImport.projectId,
        title: storeImport.title,
        description: storeImport.description.slice(0, 280),
        published: true,
      })
      setMessage(`Template “${published.title}” published to the catalog`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed")
    } finally {
      setBusy(false)
    }
  }

  const switchTab = (next: AdminTab) => {
    setTab(next)
    setError(null)
    setMessage(null)
  }

  return (
    <div className="min-h-full bg-[#07070a] text-zinc-100">
      <header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#07070a]/90 px-4 backdrop-blur-md">
        <Link href="/app" className="text-sm font-semibold tracking-tight text-white" style={{ fontFamily: '"Outfit", ui-sans-serif, system-ui, sans-serif' }}>
          Admin
        </Link>
        <Link href="/app" className="text-xs text-zinc-400 hover:text-white">
          Back to projects
        </Link>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Admin</h1>
          <div
            role="tablist"
            aria-label="Admin sections"
            className="mt-4 flex gap-1 border-b border-white/[0.06]"
          >
            {(
              [
                { id: "templates", label: "Templates" },
                { id: "clipart", label: "Clipart" },
                { id: "demos", label: "Demos" },
                { id: "backgrounds", label: "Backgrounds" },
              ] as const
            ).map((item) => {
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  id={`admin-tab-${item.id}`}
                  onClick={() => switchTab(item.id)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-[#e8ff47] text-white"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

        {tab === "templates" ? (
          <section
            role="tabpanel"
            aria-labelledby="admin-tab-templates"
            className="space-y-4"
          >
            <p className="text-sm text-zinc-400">
              Design a layout in the editor, then publish that project here for
              users to clone. Admins can publish as many templates as they want
              and can delete catalog templates (including built-in seeds).
            </p>

            <form
              onSubmit={(e) => void onImportFromStore(e)}
              className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <h2 className="text-sm font-semibold text-zinc-200">
                Import from store
              </h2>
              <p className="text-xs text-zinc-500">
                Paste an App Store or Play Store URL (or an Apple app name). We
                scrape listing screenshots, then AI analyzes each layout and
                rebuilds it as editable text, phone frames, and lenses.
              </p>
              {usingLocalBackend ? (
                <p className="text-xs text-amber-200/90">
                  Store import requires Supabase +{" "}
                  <code className="text-amber-100">import-store-app</code> and{" "}
                  <code className="text-amber-100">analyze-store-layout</code>{" "}
                  (plus <code className="text-amber-100">OPENAI_API_KEY</code>).
                </p>
              ) : null}
              <label className="block text-xs text-zinc-400">
                App Store / Play URL or Apple app name
                <input
                  value={storeQuery}
                  onChange={(e) => setStoreQuery(e.target.value)}
                  required
                  disabled={usingLocalBackend || storeBusy}
                  placeholder="https://apps.apple.com/… or https://play.google.com/store/apps/details?id=…"
                  className="mt-1 block w-full rounded border border-white/10 bg-[#0a0a0e] px-2 py-2 text-sm text-white disabled:opacity-50"
                />
              </label>
              <button
                type="submit"
                disabled={usingLocalBackend || storeBusy || !storeQuery.trim()}
                className="rounded-md bg-[#e8ff47] px-3 py-2 text-xs font-semibold text-[#0a0a0c] hover:bg-[#f0ff7a] disabled:opacity-50"
              >
                {storeBusy ? "Importing & analyzing…" : "Import listing"}
              </button>
              {storeImport ? (
                <div className="rounded-lg border border-white/10 bg-[#0a0a0e]/60 px-3 py-3 text-sm">
                  <p className="font-medium text-zinc-100">{storeImport.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {storeImport.store === "apple" ? "App Store" : "Play Store"}{" "}
                    · {storeImport.screenshotCount} screens · project ready
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/app/${storeImport.projectId}`}
                      className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900"
                    >
                      Open in editor
                    </Link>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onPublishImportedTemplate()}
                      className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Publish to catalog
                    </button>
                  </div>
                </div>
              ) : null}
            </form>

            <form
              onSubmit={(e) => void onPublishFromProject(e)}
              className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <label className="block text-xs text-zinc-400">
                Project to publish
                <select
                  name="projectId"
                  required
                  className="mt-1 block w-full rounded border border-white/10 bg-[#0a0a0e] px-2 py-2 text-sm text-white"
                  defaultValue=""
                >
                  <option value="" disabled>
                    {projects.length
                      ? "Select a project…"
                      : "No projects yet — create one in /app"}
                  </option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-zinc-400">
                Template title
                <input
                  name="title"
                  required
                  placeholder="Clean gradient hero"
                  className="mt-1 block w-full rounded border border-white/10 bg-[#0a0a0e] px-2 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Description
                <input
                  name="description"
                  placeholder="Short blurb for the gallery"
                  className="mt-1 block w-full rounded border border-white/10 bg-[#0a0a0e] px-2 py-2 text-sm text-white"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={busy || projects.length === 0}
                  className="rounded-md bg-[#e8ff47] px-3 py-2 text-xs font-semibold text-[#0a0a0c] disabled:opacity-40"
                >
                  {busy ? "Publishing…" : "Publish as template"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void publishFromCurrentSample()}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
                >
                  Or publish built-in sample
                </button>
              </div>
            </form>

            <ul className="space-y-2">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
                >
                  <TemplateThumbnail
                    template={template}
                    className="aspect-[16/10] h-14 w-24 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    {template.title}{" "}
                    <span className="text-zinc-500">
                      ({template.published ? "published" : "draft"})
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-xs text-red-400 hover:text-red-300"
                    disabled={busy}
                    onClick={() => {
                      setError(null)
                      void deleteTemplate(template.id, template.slug)
                        .then(() => reload())
                        .catch((err) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Could not delete template",
                          ),
                        )
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
              {templates.length === 0 ? (
                <li className="text-sm text-zinc-500">No templates yet.</li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {tab === "clipart" ? (
          <section
            role="tabpanel"
            aria-labelledby="admin-tab-clipart"
            className="space-y-4"
          >
            <p className="text-sm text-zinc-400">
              Upload a PNG or generate a transparent sticker with AI (admins
              only). Generated assets are previewed first, then published for
              all users.
            </p>

            <form
              onSubmit={(e) => void onGenerateClipart(e)}
              className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <h2 className="text-sm font-semibold text-zinc-200">
                Generate sticker (AI)
              </h2>
              {usingLocalBackend ? (
                <p className="text-xs text-amber-200/90">
                  AI generation requires Supabase + the{" "}
                  <code className="text-amber-100">generate-clipart</code> Edge
                  Function. Use file upload in local demo mode.
                </p>
              ) : null}
              <label className="block text-xs text-zinc-400">
                Prompt
                <input
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  required
                  maxLength={500}
                  placeholder="girl walking"
                  disabled={usingLocalBackend || genBusy}
                  className="mt-1 block w-full rounded border border-white/10 bg-[#0a0a0e] px-2 py-2 text-sm text-white disabled:opacity-50"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <label className="text-xs text-zinc-400">
                  Name
                  <input
                    value={genName}
                    onChange={(e) => setGenName(e.target.value)}
                    placeholder="Girl walking"
                    disabled={genBusy}
                    className="mt-1 block rounded border border-white/10 bg-[#0a0a0e] px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Category
                  <input
                    value={genCategory}
                    onChange={(e) => setGenCategory(e.target.value)}
                    disabled={genBusy}
                    className="mt-1 block rounded border border-white/10 bg-[#0a0a0e] px-2 py-1.5 text-sm text-white"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={usingLocalBackend || genBusy || !genPrompt.trim()}
                  className="rounded-md bg-[#e8ff47] px-3 py-2 text-xs font-semibold text-[#0a0a0c] hover:bg-[#f0ff7a] disabled:opacity-50"
                >
                  {genBusy ? "Generating…" : "Generate"}
                </button>
                {genPreviewBase64 ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || genBusy}
                      onClick={() => void onPublishGeneratedClipart()}
                      className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-50"
                    >
                      Publish to library
                    </button>
                    <button
                      type="button"
                      disabled={genBusy}
                      onClick={() => {
                        setGenPreviewBase64(null)
                        setGenPreviewMime("image/webp")
                      }}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                    >
                      Discard
                    </button>
                  </>
                ) : null}
              </div>
              {genPreviewBase64 ? (
                <div
                  className="mt-2 inline-flex rounded-lg border border-white/[0.08] p-3"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg,#3f3f46 25%,transparent 25%),linear-gradient(-45deg,#3f3f46 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#3f3f46 75%),linear-gradient(-45deg,transparent 75%,#3f3f46 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
                    backgroundColor: "#27272a",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${genPreviewMime};base64,${genPreviewBase64}`}
                    alt="Generated clipart preview"
                    className="h-40 w-40 object-contain"
                  />
                </div>
              ) : null}
            </form>

            <form
              onSubmit={(e) => void onClipartUpload(e)}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <label className="text-xs text-zinc-400">
                Name
                <input
                  name="name"
                  className="mt-1 block rounded border border-white/10 bg-[#0a0a0e] px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="text-xs text-zinc-400">
                Category
                <input
                  name="category"
                  defaultValue="general"
                  className="mt-1 block rounded border border-white/10 bg-[#0a0a0e] px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="text-xs text-zinc-400">
                File
                <input
                  name="file"
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="mt-1 block text-sm"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900"
              >
                Upload
              </button>
            </form>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {cliparts.map((clipart) => (
                <div
                  key={clipart.id}
                  className="rounded-lg border border-white/[0.08] p-2 text-center"
                >
                  {clipart.url ? (
                    <img
                      src={clipart.url}
                      alt={clipart.name}
                      className="mx-auto h-16 w-16 object-contain"
                    />
                  ) : null}
                  <div className="mt-1 truncate text-[11px]">{clipart.name}</div>
                  <button
                    type="button"
                    className="text-[10px] text-red-400"
                    onClick={() =>
                      void deleteLibraryClipart(clipart.id).then(reload)
                    }
                  >
                    Delete
                  </button>
                </div>
              ))}
              {cliparts.length === 0 ? (
                <p className="col-span-full text-sm text-zinc-500">
                  No cliparts yet.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "demos" ? (
          <section
            role="tabpanel"
            aria-labelledby="admin-tab-demos"
            className="space-y-4"
          >
            <p className="text-sm text-zinc-400">
              Generate 5 phone-aspect app UI mockups from a prompt. Published
              demos are <strong className="font-medium text-zinc-300">admin-only</strong>{" "}
              and can be applied as device screenshots in the editor.
            </p>
            <form
              onSubmit={(e) => void onGenerateDemos(e)}
              className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <h2 className="text-sm font-semibold text-zinc-200">
                Generate app demos (AI × 5)
              </h2>
              {usingLocalBackend ? (
                <p className="text-xs text-amber-200/90">
                  Requires Supabase +{" "}
                  <code className="text-amber-100">generate-media</code> Edge
                  Function.
                </p>
              ) : null}
              <label className="block text-xs text-zinc-400">
                App prompt
                <input
                  value={demoPrompt}
                  onChange={(e) => setDemoPrompt(e.target.value)}
                  required
                  maxLength={600}
                  placeholder="meditation app with calm purple UI and daily streaks"
                  disabled={usingLocalBackend || demoBusy}
                  className="mt-1 block w-full rounded border border-white/10 bg-[#0a0a0e] px-2 py-2 text-sm text-white disabled:opacity-50"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <label className="text-xs text-zinc-400">
                  Name
                  <input
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    placeholder="Calm streaks"
                    disabled={demoBusy}
                    className="mt-1 block rounded border border-white/10 bg-[#0a0a0e] px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Aspect
                  <select
                    value={demoAspect}
                    onChange={(e) =>
                      setDemoAspect(e.target.value as DemoAspect)
                    }
                    disabled={demoBusy}
                    className="mt-1 block rounded border border-white/10 bg-[#0a0a0e] px-2 py-1.5 text-sm text-white"
                  >
                    <option value="iphone">iPhone</option>
                    <option value="ipad">iPad</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={usingLocalBackend || demoBusy || !demoPrompt.trim()}
                  className="rounded-md bg-[#e8ff47] px-3 py-2 text-xs font-semibold text-[#0a0a0c] hover:bg-[#f0ff7a] disabled:opacity-50"
                >
                  {demoBusy ? "Generating 5…" : "Generate 5"}
                </button>
                {demoPreviews.length ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || demoBusy}
                      onClick={() => void onPublishDemos()}
                      className="rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      Publish all
                    </button>
                    <button
                      type="button"
                      disabled={demoBusy}
                      onClick={() => setDemoPreviews([])}
                      className="rounded-md px-3 py-2 text-xs text-zinc-400 hover:text-white"
                    >
                      Discard
                    </button>
                  </>
                ) : null}
              </div>
              {demoPreviews.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {demoPreviews.map((img, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:${img.mime};base64,${img.imageBase64}`}
                        alt={`Demo preview ${i + 1}`}
                        className="aspect-[9/19] w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </form>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {demos.map((demo) => (
                <div
                  key={demo.id}
                  className="rounded-lg border border-white/[0.08] p-2 text-center"
                >
                  {demo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={demo.url}
                      alt={demo.name}
                      className="mx-auto aspect-[9/19] w-full rounded object-cover"
                    />
                  ) : null}
                  <div className="mt-1 truncate text-[11px]">{demo.name}</div>
                  <div className="text-[10px] text-zinc-500">{demo.aspect}</div>
                  <button
                    type="button"
                    className="text-[10px] text-red-400"
                    onClick={() =>
                      void deleteDemoScreen(demo.id).then(reload)
                    }
                  >
                    Delete
                  </button>
                </div>
              ))}
              {demos.length === 0 ? (
                <p className="col-span-full text-sm text-zinc-500">
                  No demo screens yet.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "backgrounds" ? (
          <section
            role="tabpanel"
            aria-labelledby="admin-tab-backgrounds"
            className="space-y-4"
          >
            <p className="text-sm text-zinc-400">
              Generate slide backgrounds from a prompt. Published backgrounds
              appear for <strong className="font-medium text-zinc-300">all users</strong>{" "}
              in the editor Background → Image library.
            </p>
            <form
              onSubmit={(e) => void onGenerateBackground(e)}
              className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <h2 className="text-sm font-semibold text-zinc-200">
                Generate background (AI)
              </h2>
              {usingLocalBackend ? (
                <p className="text-xs text-amber-200/90">
                  Requires Supabase +{" "}
                  <code className="text-amber-100">generate-media</code> Edge
                  Function.
                </p>
              ) : null}
              <label className="block text-xs text-zinc-400">
                Prompt
                <input
                  value={bgPrompt}
                  onChange={(e) => setBgPrompt(e.target.value)}
                  required
                  maxLength={600}
                  placeholder="soft peach to coral gradient with gentle light flares"
                  disabled={usingLocalBackend || bgBusy}
                  className="mt-1 block w-full rounded border border-white/10 bg-[#0a0a0e] px-2 py-2 text-sm text-white disabled:opacity-50"
                />
              </label>
              <label className="text-xs text-zinc-400">
                Name
                <input
                  value={bgName}
                  onChange={(e) => setBgName(e.target.value)}
                  placeholder="Peach flare"
                  disabled={bgBusy}
                  className="mt-1 block rounded border border-white/10 bg-[#0a0a0e] px-2 py-1.5 text-sm text-white"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={usingLocalBackend || bgBusy || !bgPrompt.trim()}
                  className="rounded-md bg-[#e8ff47] px-3 py-2 text-xs font-semibold text-[#0a0a0c] hover:bg-[#f0ff7a] disabled:opacity-50"
                >
                  {bgBusy ? "Generating…" : "Generate"}
                </button>
                {bgPreviewBase64 ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || bgBusy}
                      onClick={() => void onPublishBackground()}
                      className="rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={bgBusy}
                      onClick={() => setBgPreviewBase64(null)}
                      className="rounded-md px-3 py-2 text-xs text-zinc-400 hover:text-white"
                    >
                      Discard
                    </button>
                  </>
                ) : null}
              </div>
              {bgPreviewBase64 ? (
                <div className="overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${bgPreviewMime};base64,${bgPreviewBase64}`}
                    alt="Background preview"
                    className="max-h-64 w-full object-cover"
                  />
                </div>
              ) : null}
            </form>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {backgrounds.map((bg) => (
                <div
                  key={bg.id}
                  className="rounded-lg border border-white/[0.08] p-2 text-center"
                >
                  {bg.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bg.url}
                      alt={bg.name}
                      className="mx-auto h-24 w-full rounded object-cover"
                    />
                  ) : null}
                  <div className="mt-1 truncate text-[11px]">{bg.name}</div>
                  <div className="text-[10px] text-zinc-500">
                    {bg.published ? "Published" : "Draft"}
                  </div>
                  <button
                    type="button"
                    className="text-[10px] text-red-400"
                    onClick={() =>
                      void deleteLibraryBackground(bg.id).then(reload)
                    }
                  >
                    Delete
                  </button>
                </div>
              ))}
              {backgrounds.length === 0 ? (
                <p className="col-span-full text-sm text-zinc-500">
                  No backgrounds yet.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
