import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import readingTime from "reading-time"

const BLOG_DIR = path.join(process.cwd(), "content", "blog")

export type BlogPostMeta = {
  slug: string
  title: string
  description: string
  date: string
  image?: string
  readingMinutes: number
}

export type BlogPost = BlogPostMeta & {
  content: string
}

function ensureBlogDir() {
  if (!fs.existsSync(BLOG_DIR)) {
    fs.mkdirSync(BLOG_DIR, { recursive: true })
  }
}

export function listBlogPosts(): BlogPostMeta[] {
  ensureBlogDir()
  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((name) => name.endsWith(".mdx") || name.endsWith(".md"))
  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf8")
    const { data, content } = matter(raw)
    const slug =
      (data.slug as string | undefined) ||
      file.replace(/\.mdx?$/, "")
    const stats = readingTime(content)
    return {
      slug,
      title: String(data.title ?? slug),
      description: String(data.description ?? ""),
      date: String(data.date ?? "1970-01-01"),
      image: data.image ? String(data.image) : undefined,
      readingMinutes: Math.max(1, Math.round(stats.minutes)),
    }
  })
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getBlogPost(slug: string): BlogPost | null {
  ensureBlogDir()
  for (const file of fs.readdirSync(BLOG_DIR)) {
    if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf8")
    const { data, content } = matter(raw)
    const fileSlug =
      (data.slug as string | undefined) || file.replace(/\.mdx?$/, "")
    if (fileSlug !== slug) continue
    const stats = readingTime(content)
    return {
      slug: fileSlug,
      title: String(data.title ?? fileSlug),
      description: String(data.description ?? ""),
      date: String(data.date ?? "1970-01-01"),
      image: data.image ? String(data.image) : undefined,
      readingMinutes: Math.max(1, Math.round(stats.minutes)),
      content,
    }
  }
  return null
}
