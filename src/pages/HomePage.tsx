import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { listPublishedTemplates } from "../api/projects"
import { useAuth } from "../auth/AuthProvider"
import {
  projectOrientation,
  type ArtboardOrientation,
} from "../orientation"
import type { TemplateRecord } from "../types/cloud"
import { TemplateThumbnail } from "../components/TemplateThumbnail"
import { SiteFooter } from "../components/SiteFooter"

export function HomePage() {
  const { userId, ready } = useAuth()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [orientation, setOrientation] =
    useState<ArtboardOrientation>("portrait")

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void listPublishedTemplates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows)
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
    return () => {
      cancelled = true
    }
  }, [ready])

  const visibleTemplates = useMemo(
    () =>
      templates.filter(
        (template) => projectOrientation(template.data) === orientation,
      ),
    [templates, orientation],
  )

  const goToEditor = () => navigate(userId ? "/app" : "/login")

  return (
    <div className="flex min-h-full flex-col bg-[#0c0c10] text-zinc-100">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <span className="text-sm font-semibold">Screenshot Studio</span>
        <div className="flex gap-3 text-sm">
          <Link to="/pricing" className="text-zinc-400 hover:text-white">
            Pricing
          </Link>
          <Link
            to={userId ? "/app" : "/login"}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {userId ? "Open app" : "Sign in"}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          App Store screenshots, without the fuss
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400">
          Create and save up to 5 projects free, with watermarked PNG previews.
          Subscribe when you need clean exports and multi-size ZIP packs.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to={userId ? "/app" : "/login"}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Get started
          </Link>
          <Link
            to="/pricing"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            View pricing
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-20 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Templates</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Browse freely. Sign in to create or edit a project.
            </p>
          </div>
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
        </div>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {visibleTemplates.map((template) => (
            <TemplateThumbnail
              key={template.id}
              template={template}
              className="w-full border border-zinc-800"
              onClick={goToEditor}
            />
          ))}
          {visibleTemplates.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No {orientation} templates published yet.
            </p>
          ) : null}
        </div>
      </section>
      <SiteFooter />
    </div>
  )
}
