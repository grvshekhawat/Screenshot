"use client"

import { useEffect, useState } from "react"
import { listPublishedTemplates } from "@/api/projects"

type Props = {
  slug: string
  title: string
  initialPreviewUrl: string | null
}

/** Fills seed template previews on the detail page when SSR has none. */
export function TemplatePreviewImage({
  slug,
  title,
  initialPreviewUrl,
}: Props) {
  const [src, setSrc] = useState(initialPreviewUrl)

  useEffect(() => {
    if (src) return
    let cancelled = false
    void listPublishedTemplates()
      .then((rows) => {
        if (cancelled) return
        const match = rows.find((row) => row.slug === slug)
        const preview =
          match?.preview_url ??
          (match?.preview_path?.startsWith("data:") ||
          match?.preview_path?.startsWith("http")
            ? match.preview_path
            : null)
        if (preview) setSrc(preview)
      })
      .catch(() => {
        /* keep empty */
      })
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
        className="w-full"
      />
    )
  }

  return (
    <div className="flex aspect-video items-center justify-center text-sm text-zinc-600">
      Loading preview…
    </div>
  )
}
