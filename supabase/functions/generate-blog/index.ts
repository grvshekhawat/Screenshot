import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { handleCors, jsonResponse, textResponse } from "../_shared/cors.ts"

const MAX_TOPIC_LEN = 300
const MAX_NOTES_LEN = 800
const MAX_BODY_LEN = 40_000

type GenerateBody = {
  action?: string
  topic?: string
  notes?: string
  title?: string
  description?: string
  slug?: string
  date?: string
  body?: string
  overwrite?: boolean
}

type BlogDraft = {
  title: string
  description: string
  slug: string
  date: string
  body: string
}

const SYSTEM_PROMPT = `You write SEO blog posts for Screenshot Studio (https://screenshot.design), an App Store / Google Play screenshot designer.

Return ONLY valid JSON with keys: title, description, slug, body.
- title: clear, specific, not clickbait
- description: meta description, max ~155 characters
- slug: lowercase kebab-case, no dates, stable forever (e.g. google-play-feature-graphic-sizes)
- body: Markdown only (no frontmatter). Structure: short intro → concrete sizes/steps → how Screenshot Studio helps → CTA linking to /templates or /login
- Use internal links when relevant: /blog/app-store-screenshot-sizes, /blog/google-play-screenshot-sizes, /blog/iphone-69-vs-65-app-store-screenshots, /blog/how-to-export-store-screenshots, /blog/iphone-duo-aso-screenshots, /templates, /login, /pricing
- Factual App Store / Play guidance; no keyword stuffing; no invented Apple/Google policies
- Mention iPhone Duo open/closed frames only when the topic involves foldables or Duo
- Do not wrap JSON in markdown fences`

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function escapeYaml(value: string): string {
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.includes("\n")) {
    return JSON.stringify(value)
  }
  return value
}

function buildMdx(draft: BlogDraft): string {
  const title = draft.title.trim()
  const description = draft.description.trim().slice(0, 200)
  const slug = sanitizeSlug(draft.slug)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
    ? draft.date
    : todayUtcDate()
  const body = draft.body.trim()
  return `---
title: ${escapeYaml(title)}
description: ${escapeYaml(description)}
date: ${date}
slug: ${slug}
---

${body}
`
}

async function requireAdmin(req: Request): Promise<Response | null> {
  const auth = req.headers.get("Authorization")
  if (!auth) return textResponse("Unauthorized", 401)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return textResponse("Unauthorized", 401)

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError) {
    return textResponse(profileError.message || "Failed to load profile", 500)
  }
  if (profile?.role !== "admin") {
    return textResponse("Admin only", 403)
  }
  return null
}

async function generateDraft(
  topic: string,
  notes: string,
  openaiKey: string,
): Promise<BlogDraft> {
  const userContent = notes
    ? `Topic: ${topic}\n\nExtra notes from editor:\n${notes}`
    : `Topic: ${topic}`

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    console.error("OpenAI chat error:", openaiRes.status, errText)
    let message = "Blog generation failed"
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      if (errText) message = errText.slice(0, 300)
    }
    throw new Error(message)
  }

  const result = (await openaiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = result.choices?.[0]?.message?.content
  if (!raw) throw new Error("No content in OpenAI response")

  let parsed: {
    title?: string
    description?: string
    slug?: string
    body?: string
  }
  try {
    parsed = JSON.parse(raw) as typeof parsed
  } catch {
    throw new Error("Model returned invalid JSON")
  }

  const title = String(parsed.title ?? "").trim()
  const description = String(parsed.description ?? "").trim()
  const slug = sanitizeSlug(String(parsed.slug ?? title))
  const body = String(parsed.body ?? "").trim()

  if (!title) throw new Error("Generated title is empty")
  if (!description) throw new Error("Generated description is empty")
  if (!slug) throw new Error("Generated slug is empty")
  if (!body) throw new Error("Generated body is empty")
  if (body.length > MAX_BODY_LEN) {
    throw new Error("Generated body is too long")
  }

  return {
    title,
    description: description.slice(0, 200),
    slug,
    date: todayUtcDate(),
    body,
  }
}

async function githubGetFileSha(
  repo: string,
  path: string,
  branch: string,
  token: string,
): Promise<string | null> {
  const url =
    `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "screenshot-studio-generate-blog",
    },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text.slice(0, 300) || "Failed to read GitHub file")
  }
  const data = (await res.json()) as { sha?: string }
  return data.sha ?? null
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

async function publishToGithub(draft: BlogDraft, overwrite: boolean) {
  const token = Deno.env.get("GITHUB_TOKEN")
  const repo = Deno.env.get("GITHUB_REPO")
  const branch = Deno.env.get("GITHUB_BRANCH")?.trim() || "main"
  if (!token) throw new Error("GITHUB_TOKEN is not configured")
  if (!repo || !repo.includes("/")) {
    throw new Error("GITHUB_REPO must be set as owner/repo")
  }

  const slug = sanitizeSlug(draft.slug)
  if (!slug) throw new Error("Invalid slug")
  const path = `content/blog/${slug}.mdx`
  const existingSha = await githubGetFileSha(repo, path, branch, token)
  if (existingSha && !overwrite) {
    const err = new Error(
      `Post already exists at ${path}. Enable overwrite to replace it.`,
    )
    ;(err as Error & { status?: number }).status = 409
    throw err
  }

  const mdx = buildMdx({ ...draft, slug })
  const message = existingSha
    ? `Update blog: ${draft.title}`
    : `Add blog: ${draft.title}`

  const putRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "screenshot-studio-generate-blog",
      },
      body: JSON.stringify({
        message,
        content: toBase64(mdx),
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    },
  )

  if (!putRes.ok) {
    const text = await putRes.text()
    console.error("GitHub put error:", putRes.status, text)
    throw new Error(text.slice(0, 400) || "GitHub publish failed")
  }

  const data = (await putRes.json()) as {
    content?: { html_url?: string; path?: string }
    commit?: { sha?: string; html_url?: string }
  }

  return {
    path,
    slug,
    branch,
    commitSha: data.commit?.sha ?? null,
    commitUrl: data.commit?.html_url ?? null,
    contentUrl: data.content?.html_url ?? null,
  }
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== "POST") return textResponse("Method not allowed", 405)

  const denied = await requireAdmin(req)
  if (denied) return denied

  let body: GenerateBody
  try {
    body = await req.json()
  } catch {
    return textResponse("Invalid JSON body", 400)
  }

  const action = String(body.action ?? "").trim()
  if (action !== "generate" && action !== "publish") {
    return textResponse('action must be "generate" or "publish"', 400)
  }

  try {
    if (action === "generate") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY")
      if (!openaiKey) {
        return textResponse("OPENAI_API_KEY is not configured", 500)
      }
      const topic = String(body.topic ?? "").trim()
      if (!topic) return textResponse("Topic is required", 400)
      if (topic.length > MAX_TOPIC_LEN) {
        return textResponse(
          `Topic must be at most ${MAX_TOPIC_LEN} characters`,
          400,
        )
      }
      const notes = String(body.notes ?? "").trim()
      if (notes.length > MAX_NOTES_LEN) {
        return textResponse(
          `Notes must be at most ${MAX_NOTES_LEN} characters`,
          400,
        )
      }
      const draft = await generateDraft(topic, notes, openaiKey)
      return jsonResponse({ action: "generate", ...draft })
    }

    // publish
    const title = String(body.title ?? "").trim()
    const description = String(body.description ?? "").trim()
    const slug = sanitizeSlug(String(body.slug ?? ""))
    const date = String(body.date ?? todayUtcDate()).trim()
    const markdown = String(body.body ?? "").trim()
    if (!title || !description || !slug || !markdown) {
      return textResponse("title, description, slug, and body are required", 400)
    }
    if (markdown.length > MAX_BODY_LEN) {
      return textResponse("Body is too long", 400)
    }

    const published = await publishToGithub(
      {
        title,
        description: description.slice(0, 200),
        slug,
        date,
        body: markdown,
      },
      body.overwrite === true,
    )
    return jsonResponse({ action: "publish", ...published })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed"
    const status =
      err instanceof Error &&
      typeof (err as Error & { status?: number }).status === "number"
        ? (err as Error & { status: number }).status
        : 502
    return textResponse(message, status)
  }
})
