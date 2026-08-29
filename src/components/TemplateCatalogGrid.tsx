"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { listPublishedTemplates } from "@/api/projects"
import type { SeoTemplate } from "@/lib/templates-seo"
import { projectOrientation } from "@/orientation"

type Props = {
  initial: SeoTemplate[]
}

/**
 * SSR ships title/description/links for SEO. Client fills missing seed
 * previews via the same catalog path as Home (canvas capture + IndexedDB).
 */
export function TemplateCatalogGrid({ initial }: Props) {
  const [templates, setTemplates] = useState(initial)

  useEffect(() => {
    let cancelled = false
    void listPublishedTemplates()
      .then((rows) => {
        if (cancelled) return
        const bySlug = new Map(rows.map((row) => [row.slug, row]))
        setTemplates((prev) =>
          prev.map((item) => {
            const live = bySlug.get(item.slug)
            if (!live) return item
            const preview =
              live.preview_url ??
              (live.preview_path?.startsWith("data:") ||
              live.preview_path?.startsWith("http")
                ? live.preview_path
                : null)
            return {
              ...item,
              title: live.title || item.title,
              description: live.description || item.description,
              preview_url: preview ?? item.preview_url,
              orientation: projectOrientation(live.data),
            }
          }),
        )
      })
      .catch(() => {
        /* keep SSR rows */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ul className="mt-10 grid gap-6 sm:grid-cols-2">
      {templates.map((template) => (
        <li key={template.id}>
          <Link
            href={`/templates/${template.slug}`}
            className="group block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 transition hover:border-zinc-600"
          >
            <div className="aspect-[16/10] bg-zinc-900">
              {template.preview_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={template.preview_url}
                  alt=""
                  className="h-full w-full object-cover object-left"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                  Loading preview…
                </div>
              )}
            </div>
            <div className="p-4">
              <h2 className="text-base font-semibold group-hover:text-white">
                {template.title}
              </h2>
              <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                {template.description ||
                  `${template.orientation} App Store screenshot template`}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-zinc-600">
                {template.orientation}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
