"use client"

import { useEffect, useState } from "react"
import {
  hydratePublishedTemplatePreviews,
  listPublishedTemplatesMeta,
} from "@/api/projects"

type Props = {
  slug: string
  title: string
  initialPreviewUrl: string | null
}

function pickPreviewUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }
  if (url.startsWith("/") && !url.startsWith("//")) return url
  if (url.startsWith("data:") && url.length < 80_000) return url
  return null
}

/** Fills seed template previews on the detail page when SSR has none. */
export function TemplatePreviewImage({
  slug,
  title,
  initialPreviewUrl,
}: Props) {
  const [src, setSrc] = useState(pickPreviewUrl(initialPreviewUrl))

  useEffect(() => {
    if (src) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await listPublishedTemplatesMeta()
        if (cancelled) return
        const match = rows.find((row) => row.slug === slug)
        const cheap = pickPreviewUrl(match?.preview_url)
        if (cheap) {
          setSrc(cheap)
          return
        }
        await hydratePublishedTemplatePreviews(rows, (updated) => {
          if (cancelled || updated.slug !== slug) return
          const preview = pickPreviewUrl(updated.preview_url)
          if (preview) setSrc(preview)
        })
      } catch {
        /* keep empty */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, src])

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`Preview of ${title}`}
        className="relative w-full"
      />
    )
  }

  return (
    <div className="flex aspect-[16/9] items-center justify-center bg-[#0a0a0e] text-sm text-zinc-600">
      Loading preview…
    </div>
  )
}
