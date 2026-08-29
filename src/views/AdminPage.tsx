"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  deleteLibraryClipart,
  deleteTemplate,
  listAllCliparts,
  listAllTemplates,
  listProjects,
  publishProjectAsTemplate,
  upsertLibraryClipart,
  upsertTemplate,
} from "../api/projects"
import {
  generateClipartPreview,
  pngBase64ToFile,
} from "../api/generate-clipart"
import { useAuth } from "../auth/AuthProvider"
import { createSampleProject } from "../constants"
import { IMAGE_ACCEPT, isImageFile, normalizeImageFile } from "../image-upload"
import { renderTemplatePreviewDataUrl } from "../template-preview"
import type {
  LibraryClipartRecord,
  ProjectRecord,
  TemplateRecord,
} from "../types/cloud"
import { TemplateThumbnail } from "../components/TemplateThumbnail"

export function AdminPage() {
  const { ready, userId, isAdmin, usingLocalBackend } = useAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [cliparts, setCliparts] = useState<LibraryClipartRecord[]>([])
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [genPrompt, setGenPrompt] = useState("")
  const [genName, setGenName] = useState("")
  const [genCategory, setGenCategory] = useState("general")
  const [genPreviewBase64, setGenPreviewBase64] = useState<string | null>(null)
  const [genBusy, setGenBusy] = useState(false)

  const reload = async () => {
    const [t, c, p] = await Promise.all([
      listAllTemplates(),
      listAllCliparts(),
      listProjects(),
    ])
    setTemplates(t)
    setCliparts(c)
    setProjects(p)
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
      <div className="flex min-h-full items-center justify-center bg-[#0c0c10] text-sm text-zinc-400">
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
      setGenPreviewBase64(result.pngBase64)
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
      const file = pngBase64ToFile(
        genPreviewBase64,
        `${(genName || "clipart").replace(/[^\w.\-]+/g, "_")}.png`,
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
      setGenPrompt("")
      setGenName("")
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-[#0c0c10] text-zinc-100">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <Link href="/app" className="text-sm font-semibold">
          Admin
        </Link>
        <Link href="/app" className="text-xs text-zinc-400 hover:text-white">
          Back to projects
        </Link>
      </header>
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

        <section>
          <h1 className="text-lg font-semibold">Templates</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Design a layout in the editor, then publish that project here for
            users to clone. Admins can publish as many templates as they want
            and can delete catalog templates (including built-in seeds).
          </p>

          <form
            onSubmit={(e) => void onPublishFromProject(e)}
            className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <label className="block text-xs text-zinc-400">
              Project to publish
              <select
                name="projectId"
                required
                className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
                defaultValue=""
              >
                <option value="" disabled>
                  {projects.length ? "Select a project…" : "No projects yet — create one in /app"}
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
                className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Description
              <input
                name="description"
                placeholder="Short blurb for the gallery"
                className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={busy || projects.length === 0}
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
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

          <ul className="mt-4 space-y-2">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-sm"
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

        <section>
          <h2 className="text-lg font-semibold">Clipart library</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Upload a PNG or generate a transparent sticker with AI (admins only).
            Generated assets are previewed first, then published for all users.
          </p>

          <form
            onSubmit={(e) => void onGenerateClipart(e)}
            className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <h3 className="text-sm font-semibold text-zinc-200">
              Generate sticker (AI)
            </h3>
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
                className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white disabled:opacity-50"
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
                  className="mt-1 block rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="text-xs text-zinc-400">
                Category
                <input
                  value={genCategory}
                  onChange={(e) => setGenCategory(e.target.value)}
                  disabled={genBusy}
                  className="mt-1 block rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={usingLocalBackend || genBusy || !genPrompt.trim()}
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
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
                    onClick={() => setGenPreviewBase64(null)}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                  >
                    Discard
                  </button>
                </>
              ) : null}
            </div>
            {genPreviewBase64 ? (
              <div
                className="mt-2 inline-flex rounded-lg border border-zinc-800 p-3"
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
                  src={`data:image/png;base64,${genPreviewBase64}`}
                  alt="Generated clipart preview"
                  className="h-40 w-40 object-contain"
                />
              </div>
            ) : null}
          </form>

          <form
            onSubmit={(e) => void onClipartUpload(e)}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <label className="text-xs text-zinc-400">
              Name
              <input
                name="name"
                className="mt-1 block rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Category
              <input
                name="category"
                defaultValue="general"
                className="mt-1 block rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white"
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
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {cliparts.map((clipart) => (
              <div
                key={clipart.id}
                className="rounded-lg border border-zinc-800 p-2 text-center"
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
          </div>
        </section>
      </main>
    </div>
  )
}
