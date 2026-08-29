import { useEffect, useMemo, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import {
  cloneTemplateToProject,
  createProject,
  deleteProject,
  listProjects,
  listPublishedTemplates,
} from "../api/projects"
import { useAuth } from "../auth/AuthProvider"
import { createSampleProject } from "../constants"
import { MAX_CLOUD_PROJECTS } from "../config"
import {
  projectOrientation,
  type ArtboardOrientation,
} from "../orientation"
import type { ProjectRecord, TemplateRecord } from "../types/cloud"
import { ProjectThumbnail } from "../components/ProjectThumbnail"
import { TemplateThumbnail } from "../components/TemplateThumbnail"

const ORIENT_KEY = "ss:projects-orientation"

export function ProjectsPage() {
  const { ready, userId, email, profile, isAdmin, signOut, usingLocalBackend, setDemoSubscription, canExport } =
    useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [orientation, setOrientation] = useState<ArtboardOrientation>(() => {
    try {
      const raw = localStorage.getItem(ORIENT_KEY)
      return raw === "landscape" ? "landscape" : "portrait"
    } catch {
      return "portrait"
    }
  })

  const reload = async () => {
    const [nextProjects, nextTemplates] = await Promise.all([
      listProjects(),
      listPublishedTemplates(),
    ])
    setProjects(nextProjects)
    setTemplates(nextTemplates)
  }

  useEffect(() => {
    if (!userId) return
    void reload().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load"),
    )
  }, [userId])

  useEffect(() => {
    try {
      localStorage.setItem(ORIENT_KEY, orientation)
    } catch {
      // ignore
    }
  }, [orientation])

  if (ready && !userId) return <Navigate to="/login" replace />

  const visibleProjects = useMemo(
    () =>
      projects.filter(
        (project) => projectOrientation(project.data) === orientation,
      ),
    [projects, orientation],
  )
  const visibleTemplates = useMemo(
    () =>
      templates.filter(
        (template) => projectOrientation(template.data) === orientation,
      ),
    [templates, orientation],
  )

  const onCreate = async () => {
    setBusy(true)
    setError(null)
    try {
      const record = await createProject(createSampleProject(orientation))
      navigate(`/app/${record.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project")
    } finally {
      setBusy(false)
    }
  }

  const onClone = async (template: TemplateRecord) => {
    setBusy(true)
    setError(null)
    try {
      const record = await cloneTemplateToProject(template)
      navigate(`/app/${record.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use template")
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return
    setBusy(true)
    try {
      await deleteProject(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-[#0c0c10] text-zinc-100">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <Link to="/" className="text-sm font-semibold">
          Screenshot Studio
        </Link>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>{email}</span>
          <span
            className={
              canExport ? "text-emerald-400" : "text-zinc-500"
            }
          >
            {canExport ? "Pro" : "Free"}
          </span>
          <Link to="/pricing" className="hover:text-white">
            Pricing
          </Link>
          {profile?.role === "admin" ? (
            <Link to="/admin" className="hover:text-white">
              Admin
            </Link>
          ) : null}
          {usingLocalBackend ? (
            <button
              type="button"
              className="hover:text-white"
              onClick={() => void setDemoSubscription(!canExport).then(() => undefined)}
            >
              {canExport ? "Clear demo Pro" : "Activate demo Pro"}
            </button>
          ) : null}
          <button type="button" onClick={() => void signOut()} className="hover:text-white">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Your projects</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {isAdmin
                ? `${projects.length} projects (no limit)`
                : `${projects.length}/${MAX_CLOUD_PROJECTS} projects`}{" "}
              · {visibleProjects.length} {orientation} · Free watermarked PNG ·
              Pro for clean ZIP
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex rounded-lg border border-zinc-800 p-0.5"
              role="group"
              aria-label="Orientation"
            >
              <button
                type="button"
                onClick={() => setOrientation("portrait")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  orientation === "portrait"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setOrientation("landscape")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  orientation === "landscape"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Landscape
              </button>
            </div>
            <button
              type="button"
              disabled={busy || (!isAdmin && projects.length >= MAX_CLOUD_PROJECTS)}
              onClick={() => void onCreate()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
            >
              New {orientation} project
            </button>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {visibleProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => navigate(`/app/${project.id}`)}
              >
                <ProjectThumbnail
                  project={project}
                  className="mb-3 w-full"
                />
                <div className="text-sm font-medium text-white">{project.name}</div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  Updated {new Date(project.updated_at).toLocaleString()}
                </div>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDelete(project.id)}
                className="mt-3 text-[11px] text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          ))}
          {visibleProjects.length === 0 ? (
            <p className="text-sm text-zinc-500 sm:col-span-2">
              No {orientation} projects yet. Create one or pick a template
              below.
            </p>
          ) : null}
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">
            Start from a {orientation} template
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {visibleTemplates.map((template) => (
              <TemplateThumbnail
                key={template.id}
                template={template}
                className="w-full border border-zinc-800"
                disabled={busy || (!isAdmin && projects.length >= MAX_CLOUD_PROJECTS)}
                onClick={() => void onClone(template)}
              />
            ))}
            {visibleTemplates.length === 0 ? (
              <p className="text-sm text-zinc-500 sm:col-span-2">
                No {orientation} templates published yet.
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}
