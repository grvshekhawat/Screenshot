import { builtInCatalogTemplates } from "@/sample-templates"
import { getSupabaseServer } from "@/lib/supabase-server"
import { isSupabaseConfigured } from "@/config"
import type { TemplateRecord } from "@/types/cloud"
import { projectOrientation, type ArtboardOrientation } from "@/orientation"

export type SeoTemplate = {
  id: string
  slug: string
  title: string
  description: string
  preview_url: string | null
  orientation: ArtboardOrientation
  sort_order: number
}

function mergeCatalog(
  published: TemplateRecord[],
  hiddenIds: string[],
): TemplateRecord[] {
  const hidden = new Set(hiddenIds)
  const seeds = builtInCatalogTemplates().filter(
    (seed) => !hidden.has(seed.id) && !hidden.has(seed.slug),
  )
  const byId = new Map(published.map((row) => [row.id, row]))
  const bySlug = new Map(published.map((row) => [row.slug, row]))
  const fromSeeds = seeds.map(
    (seed) => byId.get(seed.id) ?? bySlug.get(seed.slug) ?? seed,
  )
  const extras = published.filter(
    (row) =>
      !hidden.has(row.id) &&
      !seeds.some((seed) => seed.id === row.id || seed.slug === row.slug),
  )
  return [...fromSeeds, ...extras].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
}

async function resolvePreviewUrl(
  previewPath: string | null | undefined,
): Promise<string | null> {
  if (!previewPath) return null
  if (
    previewPath.startsWith("data:") ||
    previewPath.startsWith("http://") ||
    previewPath.startsWith("https://")
  ) {
    return previewPath
  }
  const supabase = getSupabaseServer()
  if (!supabase) return null
  const { data: signed } = await supabase.storage
    .from("templates")
    .createSignedUrl(previewPath, 60 * 60 * 24 * 7)
  if (signed?.signedUrl) return signed.signedUrl
  const { data } = supabase.storage.from("templates").getPublicUrl(previewPath)
  return data.publicUrl || null
}

/**
 * Server-safe published templates for SEO pages.
 * Resolves stored preview URLs only — never mounts Artboard / canvas capture.
 */
export async function listSeoTemplates(): Promise<SeoTemplate[]> {
  let published: TemplateRecord[] = []
  let hidden: string[] = []

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServer()!
    const [hiddenRes, templatesRes] = await Promise.all([
      supabase.from("catalog_hidden_templates").select("template_id"),
      supabase
        .from("templates")
        .select("id, slug, title, description, preview_path, data, sort_order, published")
        .eq("published", true)
        .order("sort_order"),
    ])
    if (hiddenRes.error) {
      console.warn("catalog_hidden_templates:", hiddenRes.error.message)
    } else {
      hidden = (hiddenRes.data ?? []).map((row) => row.template_id as string)
    }
    if (templatesRes.error) {
      console.warn("listSeoTemplates:", templatesRes.error.message)
    } else {
      published = (templatesRes.data ?? []) as TemplateRecord[]
    }
  }

  const merged = mergeCatalog(published, hidden)
  return Promise.all(
    merged.map(async (row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description || "",
      preview_url: await resolvePreviewUrl(row.preview_path ?? row.preview_url),
      orientation: projectOrientation(row.data),
      sort_order: row.sort_order,
    })),
  )
}

export async function getSeoTemplateBySlug(
  slug: string,
): Promise<SeoTemplate | null> {
  const all = await listSeoTemplates()
  return all.find((t) => t.slug === slug) ?? null
}
