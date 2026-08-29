import type { TemplateRecord } from "../types/cloud"
import {
  resolveThumbnailLayout,
  thumbnailAspectClass,
} from "../template-preview"
import { CatalogThumbnail } from "./CatalogThumbnail"

type TemplateThumbnailProps = {
  template: TemplateRecord
  className?: string
  onClick?: () => void
  disabled?: boolean
}

export function TemplateThumbnail({
  template,
  className = "",
  onClick,
  disabled = false,
}: TemplateThumbnailProps) {
  // Prefer preview_url (blob:/https). Avoid huge data: preview_path — Safari won't paint them.
  const src =
    template.preview_url && !template.preview_url.startsWith("data:")
      ? template.preview_url
      : template.preview_path?.startsWith("http")
        ? template.preview_path
        : template.preview_url?.startsWith("data:") &&
            template.preview_url.length < 80_000
          ? template.preview_url
          : null
  const layout = resolveThumbnailLayout(template.data)
  const aspect = thumbnailAspectClass(layout, template.data)
  const interactive = Boolean(onClick) && !disabled

  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={`Use template ${template.title}`}
        className={`group block w-full overflow-hidden rounded-lg bg-zinc-900 p-0 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${aspect} ${className}`}
      >
        <CatalogThumbnail
          src={src}
          className="h-full w-full max-h-none rounded-none"
          variant={layout === "portrait" ? "portrait" : "strip"}
          zoomOnHover={interactive}
        />
      </button>
    )
  }

  return (
    <CatalogThumbnail
      src={src}
      className={`${aspect} ${className}`.trim()}
      variant={layout === "portrait" ? "portrait" : "strip"}
      zoomOnHover
    />
  )
}
