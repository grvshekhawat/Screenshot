"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  cloneTemplateToProject,
  createProject,
  deleteProject,
  fetchProfile,
  listProjects,
  listPublishedTemplates,
} from "../api/projects"
import { useAuth } from "../auth/AuthProvider"
import { syncStripeSubscription } from "../billing/checkout"
import { createSampleProject } from "../constants"
import { MAX_CLOUD_PROJECTS } from "../config"
import {
  projectOrientation,
  type ArtboardOrientation,
} from "../orientation"
import type { ProjectRecord, TemplateRecord } from "../types/cloud"
import { MARKETING_DISPLAY } from "../components/MarketingHeader"
import { ProjectThumbnail } from "../components/ProjectThumbnail"
import { TemplateThumbnail } from "../components/TemplateThumbnail"

const ORIENT_KEY = "ss:projects-orientation"

export function ProjectsPage() {
  const {
    ready,
    userId,
    email,
    profile,
    isAdmin,
    signOut,
    usingLocalBackend,
    setDemoSubscription,
    canExport,
    refreshProfile,
  } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [orientation, setOrientation] =
    useState<ArtboardOrientation>("portrait")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORIENT_KEY)
      if (raw === "landscape" || raw === "portrait") setOrientation(raw)
    } catch {
      // ignore
    }
  }, [])

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
    if (!userId || usingLocalBackend) return
    const params = new URLSearchParams(window.location.search)
    if (params.get("subscribed") !== "1") return

    let cancelled = false
    const poll = async () => {
      for (let attempt = 0; attempt < 15 && !cancelled; attempt += 1) {
        try {
          await syncStripeSubscription()
        } catch {
          /* webhook/sync may still be catching up */
        }
        await refreshProfile()
        const next = await fetchProfile(userId)
        if (next?.subscription_status === "active") {
          params.delete("subscribed")
          const qs = params.toString()
          window.history.replaceState(
            {},
            "",
            `${window.location.pathname}${qs ? `?${qs}` : ""}`,
          )
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [userId, usingLocalBackend, refreshProfile])

  useEffect(() => {
    try {
      localStorage.setItem(ORIENT_KEY, orientation)
    } catch {
      // ignore
    }
  }, [orientation])

  useEffect(() => {
    if (ready && !userId) router.replace("/login")
  }, [ready, userId, router])

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

  if (ready && !userId) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#07070a] text-sm text-zinc-400">
        Redirecting…
      </div>
    )
  }

  const atCap = !isAdmin && projects.length >= MAX_CLOUD_PROJECTS

  const onCreate = async () => {
    if (atCap) {
      setError(
        `Project limit reached (${MAX_CLOUD_PROJECTS}). Delete a project to create another.`,
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      const record = await createProject(createSampleProject(orientation))
      router.push(`/app/${record.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project")
    } finally {
      setBusy(false)
    }
  }

  const onClone = async (template: TemplateRecord) => {
    if (atCap) {
      setError(
        `Project limit reached (${MAX_CLOUD_PROJECTS}). Delete a project to start from a template.`,
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      const record = await cloneTemplateToProject(template)
      router.push(`/app/${record.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use template")
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return
    setBusy(true)
    setError(null)
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
    <div className="min-h-full bg-[#07070a] text-zinc-100">
      <header className="relative z-20 border-b border-white/[0.06] bg-[#07070a]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-[-0.02em] text-white"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            Screenshot Studio
          </Link>
          <div className="flex items-center gap-1 text-[12px] text-zinc-500 sm:gap-2 sm:text-[13px]">
            <span className="hidden max-w-[160px] truncate sm:inline">
              {email}
            </span>
            <span
              className={
                canExport
                  ? "rounded px-1.5 py-0.5 text-[#e8ff47]/90"
                  : "rounded px-1.5 py-0.5 text-zinc-500"
              }
            >
              {canExport ? "Pro" : "Free"}
            </span>
            <Link
              href="/pricing"
              className="rounded-md px-2 py-1.5 transition hover:text-white"
            >
              Pricing
            </Link>
            {profile?.role === "admin" ? (
              <Link
                href="/admin"
                className="rounded-md px-2 py-1.5 transition hover:text-white"
              >
                Admin
              </Link>
            ) : null}
            {usingLocalBackend ? (
              <button
                type="button"
                className="rounded-md px-2 py-1.5 transition hover:text-white"
                onClick={() =>
                  void setDemoSubscription(!canExport).then(() => undefined)
                }
              >
                {canExport ? "Clear demo Pro" : "Demo Pro"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md px-2 py-1.5 transition hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
        <div
          className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.08),transparent_70%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-8 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(232,255,71,0.05),transparent_70%)]"
          aria-hidden
        />

        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1
              className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl"
              style={{ fontFamily: MARKETING_DISPLAY }}
            >
              Your projects
            </h1>
            <p className="mt-2 text-[14px] text-zinc-500">
              {isAdmin
                ? `${projects.length} projects`
                : `${projects.length} of ${MAX_CLOUD_PROJECTS} projects`}
              <span className="mx-2 text-zinc-700">·</span>
              {visibleProjects.length} {orientation}
              <span className="mx-2 text-zinc-700">·</span>
              {atCap
                ? "Limit reached — delete one to add another"
                : "Free watermarked PNG · Pro for clean ZIP"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex rounded-md border border-white/10 p-0.5"
              role="group"
              aria-label="Orientation"
            >
              <button
                type="button"
                onClick={() => setOrientation("portrait")}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                  orientation === "portrait"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setOrientation("landscape")}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                  orientation === "landscape"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Landscape
              </button>
            </div>
            <button
              type="button"
              disabled={busy || atCap}
              title={
                atCap
                  ? `Limit of ${MAX_CLOUD_PROJECTS} projects reached. Delete one to create another.`
                  : undefined
              }
              onClick={() => void onCreate()}
              className="rounded-md bg-[#e8ff47] px-4 py-2 text-sm font-semibold text-[#0a0a0c] transition hover:bg-[#f0ff7a] disabled:opacity-40"
            >
              New {orientation} project
            </button>
          </div>
        </div>

        {error ? (
          <p className="relative mt-4 text-sm text-red-400">{error}</p>
        ) : null}

        {atCap ? (
          <div
            role="status"
            className="relative mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[14px] leading-relaxed text-amber-100"
          >
            <p className="font-medium text-amber-50">
              Project limit reached ({MAX_CLOUD_PROJECTS}/{MAX_CLOUD_PROJECTS})
            </p>
            <p className="mt-1 text-amber-100/85">
              Delete an existing project to free a slot, then you can create a
              new one or start from a template.
            </p>
          </div>
        ) : null}

        <div className="relative mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
          {visibleProjects.map((project) => (
            <div key={project.id} className="group">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => router.push(`/app/${project.id}`)}
              >
                <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-zinc-950/60 transition duration-300 group-hover:border-white/15 group-hover:shadow-[0_24px_60px_-40px_rgba(232,255,71,0.1)]">
                  <ProjectThumbnail
                    project={project}
                    className="mb-0 w-full rounded-none border-0"
                  />
                </div>
              </button>
              <div className="mt-3 flex items-start justify-between gap-3 px-0.5">
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => router.push(`/app/${project.id}`)}
                >
                  <div
                    className="truncate text-[15px] font-semibold tracking-tight text-white"
                    style={{ fontFamily: MARKETING_DISPLAY }}
                  >
                    {project.name}
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    Updated {new Date(project.updated_at).toLocaleString()}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDelete(project.id)}
                  className="shrink-0 pt-0.5 text-[11px] text-zinc-600 transition hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {visibleProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-6 py-14 text-center sm:col-span-2">
              <p
                className="text-lg font-semibold tracking-tight text-zinc-200"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                No {orientation} projects yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-zinc-500">
                {atCap
                  ? `You’ve used all ${MAX_CLOUD_PROJECTS} project slots in other orientations. Delete a project above to create a ${orientation} one.`
                  : "Start blank or pick a template below—your screenshots stay here until you export."}
              </p>
              {!atCap ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCreate()}
                  className="mt-6 rounded-md bg-[#e8ff47] px-5 py-2.5 text-sm font-semibold text-[#0a0a0c] transition hover:bg-[#f0ff7a] disabled:opacity-40"
                >
                  Create {orientation} project
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <section className="relative mt-16 border-t border-white/[0.06] pt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                Start from a template
              </h2>
              <p className="mt-2 text-[14px] text-zinc-500">
                {atCap
                  ? `Templates are paused until you delete a project (${MAX_CLOUD_PROJECTS} max).`
                  : `${orientation} layouts—click to clone into a new project.`}
              </p>
            </div>
            <Link
              href="/templates"
              className="text-[13px] text-zinc-400 underline decoration-white/15 underline-offset-4 transition hover:text-zinc-200 hover:decoration-white/40"
            >
              Browse all templates
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {visibleTemplates.map((template) => (
              <TemplateThumbnail
                key={template.id}
                template={template}
                className="w-full border border-white/[0.07] transition hover:border-white/15"
                disabled={busy || atCap}
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
