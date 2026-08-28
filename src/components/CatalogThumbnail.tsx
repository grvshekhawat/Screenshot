type CatalogThumbnailProps = {
  src?: string | null
  className?: string
  /** Wider strip for multi-slide previews; portrait for stacked layout. */
  variant?: "strip" | "portrait"
  /** Subtle scale-up on hover (template cards). */
  zoomOnHover?: boolean
}

/** Shared image card for template + project multi-slide previews. */
export function CatalogThumbnail({
  src,
  className = "",
  variant = "strip",
  zoomOnHover = false,
}: CatalogThumbnailProps) {
  const aspect =
    variant === "portrait" ? "aspect-[10/16]" : "aspect-[2.3/1]"

  return (
    <div
      className={`overflow-hidden rounded-lg bg-zinc-900 ${
        className || aspect
      }`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className={`h-full w-full object-contain object-center ${
            zoomOnHover
              ? "transition-transform duration-300 ease-out group-hover:scale-[1.06] hover:scale-[1.06]"
              : ""
          }`}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-violet-600/35 via-zinc-900 to-zinc-950" />
      )}
    </div>
  )
}
