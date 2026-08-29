import type { MetadataRoute } from "next"
import { siteOrigin } from "@/config"

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin()
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/app/", "/admin", "/login"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
