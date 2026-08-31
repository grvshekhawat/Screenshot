import type { MetadataRoute } from "next"
import { listBlogPosts } from "@/lib/blog"
import { listSeoTemplates } from "@/lib/templates-seo"
import { siteOrigin } from "@/config"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin()
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/pricing",
    "/templates",
    "/blog",
    "/blog/rss.xml",
    "/terms",
    "/privacy",
  ].map((path) => ({
    url: `${origin}${path || "/"}`,
    changeFrequency: path === "" || path === "/blog" ? "weekly" : "monthly",
    priority:
      path === ""
        ? 1
        : path === "/templates" || path === "/pricing"
          ? 0.8
          : path === "/blog/rss.xml"
            ? 0.3
            : 0.5,
  }))

  const posts = listBlogPosts().map((post) => ({
    url: `${origin}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }))

  let templates: MetadataRoute.Sitemap = []
  try {
    templates = (await listSeoTemplates()).map((t) => ({
      url: `${origin}/templates/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  } catch (err) {
    console.warn("sitemap templates:", err)
  }

  return [...staticRoutes, ...posts, ...templates]
}
