import type { ProjectRecord } from "../types/cloud"
import {
  resolveThumbnailLayout,
  thumbnailAspectClass,
} from "../template-preview"
import { CatalogThumbnail } from "./CatalogThumbnail"

type ProjectThumbnailProps = {
  project: ProjectRecord
  className?: string
}

export function ProjectThumbnail({
  project,
  className = "",
}: ProjectThumbnailProps) {
  const src =
    project.thumbnail_url ??
    (project.thumbnail_path?.startsWith("data:") ||
    project.thumbnail_path?.startsWith("http")
      ? project.thumbnail_path
      : null)
  const layout = resolveThumbnailLayout(project.data)
  const aspect = thumbnailAspectClass(layout, project.data)

  return (
    <CatalogThumbnail
      src={src}
      className={`${aspect} ${className}`.trim()}
      variant={layout === "portrait" ? "portrait" : "strip"}
    />
  )
}
