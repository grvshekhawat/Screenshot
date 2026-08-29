import { ImageResponse } from "next/og"

export const alt = "Screenshot Studio"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background:
            "linear-gradient(145deg, #0c0c10 0%, #1a1028 55%, #0c0c10 100%)",
          color: "#fafafa",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 28, color: "#a78bfa", letterSpacing: 2 }}>
          SCREENSHOT.DESIGN
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          App Store &amp; Play screenshots
        </div>
        <div
          style={{ marginTop: 20, fontSize: 28, color: "#a1a1aa", maxWidth: 800 }}
        >
          Templates, device frames, multi-size ZIP exports
        </div>
      </div>
    ),
    { ...size },
  )
}
