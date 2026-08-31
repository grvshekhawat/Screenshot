"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  hydratePublishedTemplatePreviews,
  listPublishedTemplatesMeta,
} from "@/api/projects"
import type { SeoTemplate } from "@/lib/templates-seo"
import {
  projectOrientation,
  type ArtboardOrientation,
} from "@/orientation"
import { MARKETING_DISPLAY } from "./MarketingHeader"

type Props = {
  initial: SeoTemplate[]
}

function pickPreviewUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (
    url.startsWith("blob:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url
  }
  if (url.startsWith("/") && !url.startsWith("//")) return url
  if (url.startsWith("data:") && url.length < 80_000) return url
  return null
}

/**
 * SSR ships title/description/links for SEO. Client fills missing seed
 * previews progressively (canvas paint + IndexedDB) so admin HTTPS cards
 * stay visible while seeds generate.
 */
export function TemplateCatalogGrid({ initial }: Props) {
  const [templates, setTemplates] = useState(initial)
  const [orientation, setOrientation] =
    useState<ArtboardOrientation>("portrait")

  useEffect(() => {
    let cancelled = false

    const applyPreview = (slug: string, preview: string | null) => {
      if (!preview || cancelled) return
      setTemplates((prev) =>
        prev.map((item) =>
          item.slug === slug ? { ...item, preview_url: preview } : item,
        ),
      )
    }

    void (async () => {
      try {
        const rows = await listPublishedTemplatesMeta()
        if (cancelled) return
        const bySlug = new Map(rows.map((row) => [row.slug, row]))
        setTemplates((prev) =>
          prev.map((item) => {
            const live = bySlug.get(item.slug)
            if (!live) return item
            return {
              ...item,
              title: live.title || item.title,
              description: live.description || item.description,
              preview_url:
                pickPreviewUrl(live.preview_url) ?? item.preview_url,
              orientation: projectOrientation(live.data),
            }
          }),
        )

        await hydratePublishedTemplatePreviews(rows, (updated) => {
          applyPreview(updated.slug, pickPreviewUrl(updated.preview_url))
        })
      } catch {
        /* keep SSR rows */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(
    () => templates.filter((t) => t.orientation === orientation),
    [templates, orientation],
  )

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-zinc-500">
          {visible.length} {orientation}{" "}
          {visible.length === 1 ? "layout" : "layouts"}
        </p>
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
      </div>

      <ul className="mt-6 grid gap-8 sm:grid-cols-2">
        {visible.map((template, index) => (
          <li
            key={template.id}
            className="ss-fade-up"
            style={{ animationDelay: `${Math.min(index, 5) * 0.06}s` }}
          >
            <Link
              href={`/templates/${template.slug}`}
              className="group block"
            >
              <div className="relative overflow-hidden rounded-lg border border-white/[0.07] bg-zinc-950/80 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)] transition duration-300 group-hover:border-white/15 group-hover:shadow-[0_28px_70px_-36px_rgba(232,255,71,0.12)]">
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(ellipse at 30% 0%, rgba(232,255,71,0.06), transparent 55%)",
                  }}
                  aria-hidden
                />
                <div className="aspect-[16/10] bg-[#0a0a0e]">
                  {template.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={template.preview_url}
                      alt=""
                      className="h-full w-full object-cover object-left transition duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                      Loading preview…
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-start justify-between gap-3 px-0.5">
                <div className="min-w-0">
                  <h2
                    className="truncate text-[15px] font-semibold tracking-tight text-zinc-100 transition group-hover:text-white"
                    style={{ fontFamily: MARKETING_DISPLAY }}
                  >
                    {template.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-zinc-500">
                    {template.description ||
                      `${template.orientation} App Store screenshot template`}
                  </p>
                </div>
                <span className="shrink-0 pt-0.5 text-[10px] font-medium tracking-[0.12em] text-zinc-600 uppercase">
                  {template.orientation}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          No {orientation} templates published yet.
        </p>
      ) : null}
    </div>
  )
}
