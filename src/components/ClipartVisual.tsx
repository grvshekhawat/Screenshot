import type { ClipartLayer } from "../types"

function cssUrl(url: string): string {
  return `url(${JSON.stringify(url)})`
}

/** Shared paint for clipart image + recolor / opacity / shadow. */
export function ClipartVisual({
  clipart,
  imageUrl,
}: {
  clipart: ClipartLayer
  imageUrl: string | null
}) {
  if (!imageUrl) return null

  const opacity =
    typeof clipart.opacity === "number" && Number.isFinite(clipart.opacity)
      ? Math.min(1, Math.max(0, clipart.opacity))
      : 1
  const shadow =
    typeof clipart.shadow === "number" && clipart.shadow > 0
      ? Math.min(48, clipart.shadow)
      : 0
  const recolor = clipart.recolor ?? "off"
  const color = clipart.color ?? "#fbbf24"
  const color2 = clipart.color2 ?? "#f97316"
  const colorAngle =
    typeof clipart.colorAngle === "number" ? clipart.colorAngle : 135

  const filter =
    shadow > 0
      ? `drop-shadow(0 ${Math.max(2, shadow * 0.35)}px ${shadow}px rgba(0,0,0,0.45))`
      : undefined

  if (recolor === "off") {
    return (
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "fill",
          opacity,
          filter,
          pointerEvents: "none",
        }}
      />
    )
  }

  const background =
    recolor === "gradient"
      ? `linear-gradient(${colorAngle}deg, ${color}, ${color2})`
      : color
  const mask = cssUrl(imageUrl)

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        opacity,
        background,
        filter,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        pointerEvents: "none",
      }}
    />
  )
}
