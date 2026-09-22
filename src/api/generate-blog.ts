import { config, isSupabaseConfigured } from "../config"
import { getSupabase } from "../lib/supabase"

export type BlogDraft = {
  title: string
  description: string
  slug: string
  date: string
  body: string
}

export type PublishBlogResult = {
  path: string
  slug: string
  branch: string
  commitSha: string | null
  commitUrl: string | null
  contentUrl: string | null
}

async function postGenerateBlog(
  body: Record<string, unknown>,
): Promise<Response> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "AI blog generation requires Supabase (not available in local demo mode).",
    )
  }
  const base = config.billingFunctionsBase
  if (!base) {
    throw new Error(
      "Billing functions URL is not configured (NEXT_PUBLIC_BILLING_FUNCTIONS_URL).",
    )
  }

  const supabase = getSupabase()!
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error("Not signed in")

  return fetch(`${base.replace(/\/$/, "")}/generate-blog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
}

/** Admin-only: generate an SEO blog draft from a topic. */
export async function generateBlogPreview(input: {
  topic: string
  notes?: string
}): Promise<BlogDraft> {
  const topic = input.topic.trim()
  if (!topic) throw new Error("Topic is required")

  const response = await postGenerateBlog({
    action: "generate",
    topic,
    notes: input.notes?.trim() || undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "Blog generation failed")
  }

  const raw = (await response.json()) as Partial<BlogDraft>
  if (
    !raw.title ||
    !raw.description ||
    !raw.slug ||
    !raw.body ||
    !raw.date
  ) {
    throw new Error("Invalid generate-blog response")
  }

  return {
    title: String(raw.title),
    description: String(raw.description),
    slug: String(raw.slug),
    date: String(raw.date),
    body: String(raw.body),
  }
}

/** Admin-only: commit MDX to content/blog/{slug}.mdx on GitHub. */
export async function publishBlogPost(input: {
  title: string
  description: string
  slug: string
  date: string
  body: string
  overwrite?: boolean
}): Promise<PublishBlogResult> {
  const response = await postGenerateBlog({
    action: "publish",
    title: input.title.trim(),
    description: input.description.trim(),
    slug: input.slug.trim(),
    date: input.date.trim(),
    body: input.body.trim(),
    overwrite: input.overwrite === true,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "Blog publish failed")
  }

  const raw = (await response.json()) as Partial<PublishBlogResult>
  if (!raw.path || !raw.slug || !raw.branch) {
    throw new Error("Invalid publish response")
  }

  return {
    path: String(raw.path),
    slug: String(raw.slug),
    branch: String(raw.branch),
    commitSha: raw.commitSha ? String(raw.commitSha) : null,
    commitUrl: raw.commitUrl ? String(raw.commitUrl) : null,
    contentUrl: raw.contentUrl ? String(raw.contentUrl) : null,
  }
}
