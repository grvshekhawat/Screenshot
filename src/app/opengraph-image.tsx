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
            "linear-gradient(145deg, #07070a 0%, #0c1820 45%, #121408 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: "#e8ff47",
            letterSpacing: 3,
            fontWeight: 600,
          }}
        >
          SCREENSHOT STUDIO
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -1.5,
          }}
        >
          App Store &amp; Play screenshots
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            color: "#a1a1aa",
            maxWidth: 800,
          }}
        >
          Templates, device frames, multi-size ZIP exports
        </div>
      </div>
    ),
    { ...size },
  )
}
