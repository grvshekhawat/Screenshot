import { get, set, del } from "idb-keyval"
import { isSupabaseConfigured, MAX_CLOUD_PROJECTS } from "../config"
import { assetIdsFromProject } from "../assets"
import { createSampleProject, normalizeProject } from "../constants"
import { blobUrlToDataUrl } from "../export-canvas"
import {
  builtInCatalogTemplates,
  CATALOG_SEED_VERSION,
} from "../sample-templates"
import { sampleScreenDataUrl } from "../sample-screens"
import { getSupabase } from "../lib/supabase"
import { loadScreenshot } from "../storage"
import {
  renderProjectPreviewBlob,
  renderProjectPreviewDataUrl,
  renderTemplatePreviewBlob,
  renderTemplatePreviewDataUrl,
} from "../template-preview"
import type {
  DemoAspect,
  LibraryBackgroundRecord,
  LibraryClipartRecord,
  LibraryDemoScreenRecord,
  Profile,
  ProjectRecord,
  TemplateRecord,
} from "../types/cloud"
import type { Project } from "../types"
import * as local from "./local-backend"

const SEED_PREVIEW_KEY = (id: string) =>
  `ss-seed-preview-v${CATALOG_SEED_VERSION}:${id}`

async function readSeedPreviewCache(id: string): Promise<Blob | null> {
  try {
    const value = await get(SEED_PREVIEW_KEY(id))
    if (value instanceof Blob && value.size > 0) return value
    // Legacy string/data-URL caches — drop them. Migrating via fetch(dataUrl)
    // can hang Safari/Chrome on multi‑MB strings and blocks the whole catalog.
    if (value != null) {
      try {
        await del(SEED_PREVIEW_KEY(id))
      } catch {
        /* ignore */
      }
    }
    return null
  } catch {
    return null
  }
}

async function writeSeedPreviewCache(id: string, preview: Blob): Promise<void> {
  try {
    await set(SEED_PREVIEW_KEY(id), preview)
  } catch {
    /* quota — list still works with the in-memory url this visit */
  }
}

function seedPreviewDisplayUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}

async function renderSeedPreviewBlob(project: Project): Promise<Blob> {
  return renderTemplatePreviewBlob(project, {
    assetUrls: await resolvePreviewAssetUrls(project),
    // Canvas paint only — skip DOM capture queue (see export-slide lock).
    paintOnly: true,
  })
}

function isBuiltInSeedId(id: string): boolean {
  return builtInCatalogTemplates().some((seed) => seed.id === id)
}

function isUsablePreviewUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://")) {
    return true
  }
  if (url.startsWith("/") && !url.startsWith("//")) return true
  // Short data URLs only (SVG placeholders etc.) — never multi‑MB strips.
  return url.startsWith("data:") && url.length < 80_000
}

function mapProject(row: Record<string, unknown>): ProjectRecord {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    target_id: row.target_id as string,
    data: normalizeProject(row.data as Project),
    thumbnail_path: (row.thumbnail_path as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function resolveProjectThumbnailUrl(
  thumbnailPath: string | null | undefined,
): Promise<string | null> {
  if (!thumbnailPath) return null
  if (
    thumbnailPath.startsWith("data:") ||
    thumbnailPath.startsWith("http://") ||
    thumbnailPath.startsWith("https://") ||
    thumbnailPath.startsWith("blob:") ||
    thumbnailPath.startsWith("/")
  ) {
    return thumbnailPath
  }
  if (!isSupabaseConfigured()) return thumbnailPath
  const supabase = getSupabase()!
  const { data: signed } = await supabase.storage
    .from("project-assets")
    .createSignedUrl(thumbnailPath, 60 * 60 * 24 * 7)
  if (signed?.signedUrl) return signed.signedUrl
  const { data } = supabase.storage
    .from("project-assets")
    .getPublicUrl(thumbnailPath)
  return data.publicUrl
}

async function resolvePreviewAssetUrls(
  project: Project,
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}
  const resolved = await resolveAssetUrls(assetIdsFromProject(project))
  await Promise.all(
    Object.entries(resolved).map(async ([id, url]) => {
      if (!url) return
      // Data URLs survive DOM capture without CORS / fetch failures.
      if (url.startsWith("data:")) {
        urls[id] = url
        return
      }
      try {
        urls[id] = await blobUrlToDataUrl(url)
      } catch {
        urls[id] = url
      }
    }),
  )
  // Fill any missing via local screenshot blobs.
  await Promise.all(
    assetIdsFromProject(project).map(async (id) => {
      if (urls[id]) return
      const blob = await loadScreenshot(id)
      if (!blob) return
      const objectUrl = URL.createObjectURL(blob)
      try {
        urls[id] = await blobUrlToDataUrl(objectUrl)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }),
  )
  return urls
}

function withCacheBust(url: string, version: string | null | undefined): string {
  if (!version) return url
  if (url.startsWith("data:") || url.startsWith("blob:")) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}v=${encodeURIComponent(version)}`
}

async function withProjectThumbnail(
  project: ProjectRecord,
): Promise<ProjectRecord> {
  if (project.thumbnail_path) {
    const resolved = await resolveProjectThumbnailUrl(project.thumbnail_path)
    if (resolved) {
      return {
        ...project,
        thumbnail_url: withCacheBust(resolved, project.updated_at),
      }
    }
  }

  try {
    const data = normalizeProject(project.data)
    if (!isSupabaseConfigured()) {
      const thumbnail_url = await renderProjectPreviewDataUrl(data, {
        assetUrls: await resolvePreviewAssetUrls(data),
        paintOnly: false,
      })
      await local.localSetProjectThumbnail(project.id, thumbnail_url)
      return { ...project, thumbnail_path: thumbnail_url, thumbnail_url }
    }
    const thumbnail_path = await buildProjectThumbnailPath(project.id, data)
    if (!thumbnail_path) return project
    const resolved = await resolveProjectThumbnailUrl(thumbnail_path)
    return {
      ...project,
      thumbnail_path,
      thumbnail_url: resolved
        ? withCacheBust(resolved, project.updated_at)
        : undefined,
    }
  } catch {
    return project
  }
}

async function withProjectThumbnails(
  projects: ProjectRecord[],
): Promise<ProjectRecord[]> {
  return Promise.all(projects.map((project) => withProjectThumbnail(project)))
}

async function buildProjectThumbnailPath(
  projectId: string,
  project: Project,
): Promise<string | null> {
  try {
    const data = normalizeProject(project)
    const assetUrls = await resolvePreviewAssetUrls(data)
    if (!isSupabaseConfigured()) {
      return await renderProjectPreviewDataUrl(data, {
        assetUrls,
        paintOnly: false,
      })
    }
    const supabase = getSupabase()!
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const blob = await renderProjectPreviewBlob(data, {
      assetUrls,
      paintOnly: false,
    })
    const path = `${user.id}/${projectId}/thumbnail.webp`
    const { error } = await supabase.storage
      .from("project-assets")
      .upload(path, blob, {
        upsert: true,
        contentType: blob.type || "image/webp",
      })
    if (error) return null
    return path
  } catch {
    return null
  }
}

/** Prefer signed URL (works on private buckets); fall back to public URL. */
async function resolveClipartUrl(storagePath: string): Promise<string> {
  return resolveBucketUrl("cliparts", storagePath)
}

async function resolveBucketUrl(
  bucket: string,
  storagePath: string,
): Promise<string> {
  const supabase = getSupabase()!
  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
  if (signed?.signedUrl) return signed.signedUrl
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  return data.publicUrl
}

async function withClipartUrl(
  record: LibraryClipartRecord,
): Promise<LibraryClipartRecord> {
  if (!record.storage_path) return record
  return { ...record, url: await resolveClipartUrl(record.storage_path) }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return local.localGetProfile()
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function listProjects(): Promise<ProjectRecord[]> {
  if (!isSupabaseConfigured()) {
    return withProjectThumbnails(await local.localListProjects())
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false })
  if (error) throw error
  return withProjectThumbnails((data ?? []).map((row) => mapProject(row)))
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  if (!isSupabaseConfigured()) return local.localGetProject(id)
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data ? mapProject(data) : null
}

export async function createProject(
  project: Project = createSampleProject(),
): Promise<ProjectRecord> {
  if (!isSupabaseConfigured()) return local.localCreateProject(project)
  const supabase = getSupabase()!
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: project.name,
      target_id: project.targetId,
      data: project,
    })
    .select("*")
    .single()
  if (error) {
    const msg = error.message || ""
    if (/project limit/i.test(msg)) {
      throw new Error(
        `Project limit reached (${MAX_CLOUD_PROJECTS}). Delete a project to create another.`,
      )
    }
    throw error
  }
  const record = mapProject(data)
  const thumbnail_path = await buildProjectThumbnailPath(record.id, project)
  if (!thumbnail_path) return record
  const { data: updated, error: thumbError } = await supabase
    .from("projects")
    .update({ thumbnail_path })
    .eq("id", record.id)
    .select("*")
    .single()
  if (thumbError || !updated) return { ...record, thumbnail_path }
  return mapProject(updated)
}

export async function saveProjectRecord(
  id: string,
  project: Project,
): Promise<ProjectRecord> {
  if (!isSupabaseConfigured()) return local.localSaveProject(id, project)
  const supabase = getSupabase()!
  const thumbnail_path = await buildProjectThumbnailPath(id, project)
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: project.name,
      target_id: project.targetId,
      data: project,
      ...(thumbnail_path ? { thumbnail_path } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return mapProject(data)
}

export async function deleteProject(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return local.localDeleteProject(id)
  const supabase = getSupabase()!
  const { error } = await supabase.from("projects").delete().eq("id", id)
  if (error) throw error
}

export async function uploadProjectAsset(
  assetId: string,
  file: Blob,
): Promise<string> {
  if (!isSupabaseConfigured()) return local.localSaveAsset(assetId, file)
  const supabase = getSupabase()!
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")
  const path = `${user.id}/${assetId}`
  const { error } = await supabase.storage
    .from("project-assets")
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" })
  if (error) throw error
  const { data: signed, error: signedError } = await supabase.storage
    .from("project-assets")
    .createSignedUrl(path, 60 * 60 * 24 * 7)
  if (!signedError && signed?.signedUrl) return signed.signedUrl
  // Local blob URL still works in this session if signing fails
  return URL.createObjectURL(file)
}

export async function resolveAssetUrl(assetId: string): Promise<string | null> {
  const map = await resolveAssetUrls([assetId])
  return map[assetId] ?? null
}

/**
 * Resolve many project/library asset URLs with one auth lookup and batched
 * signed URL creation (avoids N× getUser when opening multi-size projects).
 */
export async function resolveAssetUrls(
  assetIds: string[],
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}
  if (assetIds.length === 0) return urls

  const projectIds: string[] = []
  const libraryIds: string[] = []

  for (const assetId of assetIds) {
    const sample = sampleScreenDataUrl(assetId)
    if (sample) {
      urls[assetId] = sample
      continue
    }
    if (assetId.startsWith("library:")) {
      libraryIds.push(assetId)
      continue
    }
    if (assetId.startsWith("demo:") || assetId.startsWith("background:")) {
      continue
    }
    projectIds.push(assetId)
  }

  if (libraryIds.length > 0) {
    await Promise.all(
      libraryIds.map(async (assetId) => {
        const libraryId = assetId.slice("library:".length)
        if (!isSupabaseConfigured()) {
          const url = await local.localLoadLibraryClipartUrl(libraryId)
          if (url) urls[assetId] = url
          return
        }
        const supabase = getSupabase()!
        const { data, error } = await supabase
          .from("library_cliparts")
          .select("storage_path")
          .eq("id", libraryId)
          .maybeSingle()
        if (error || !data?.storage_path) return
        const url = await resolveClipartUrl(data.storage_path as string)
        if (url) urls[assetId] = url
      }),
    )
  }

  const demoIds = assetIds.filter((id) => id.startsWith("demo:"))
  if (demoIds.length > 0) {
    await Promise.all(
      demoIds.map(async (assetId) => {
        const id = assetId.slice("demo:".length)
        if (!isSupabaseConfigured()) {
          const url = await local.localLoadDemoScreenUrl(id)
          if (url) urls[assetId] = url
          return
        }
        const supabase = getSupabase()!
        const { data, error } = await supabase
          .from("library_demo_screens")
          .select("storage_path")
          .eq("id", id)
          .maybeSingle()
        if (error || !data?.storage_path) return
        const url = await resolveBucketUrl("demo-screens", data.storage_path)
        if (url) urls[assetId] = url
      }),
    )
  }

  const backgroundIds = assetIds.filter((id) => id.startsWith("background:"))
  if (backgroundIds.length > 0) {
    await Promise.all(
      backgroundIds.map(async (assetId) => {
        const id = assetId.slice("background:".length)
        if (!isSupabaseConfigured()) {
          const url = await local.localLoadBackgroundUrl(id)
          if (url) urls[assetId] = url
          return
        }
        const supabase = getSupabase()!
        const { data, error } = await supabase
          .from("library_backgrounds")
          .select("storage_path")
          .eq("id", id)
          .maybeSingle()
        if (error || !data?.storage_path) return
        const url = await resolveBucketUrl("backgrounds", data.storage_path)
        if (url) urls[assetId] = url
      }),
    )
  }

  if (projectIds.length === 0) return urls

  if (!isSupabaseConfigured()) {
    await Promise.all(
      projectIds.map(async (assetId) => {
        const url = await local.localLoadAsset(assetId)
        if (url) urls[assetId] = url
      }),
    )
    return urls
  }

  const supabase = getSupabase()!
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return urls

  const paths = projectIds.map((id) => `${user.id}/${id}`)
  const { data: signedBatch, error } = await supabase.storage
    .from("project-assets")
    .createSignedUrls(paths, 60 * 60 * 24 * 7)

  if (!error && signedBatch) {
    for (const row of signedBatch) {
      if (!row.path || !row.signedUrl || row.error) continue
      const prefix = `${user.id}/`
      const assetId = row.path.startsWith(prefix)
        ? row.path.slice(prefix.length)
        : row.path
      urls[assetId] = row.signedUrl
    }
  } else {
    // Fallback: parallel individual signs (still one getUser above).
    await Promise.all(
      projectIds.map(async (assetId) => {
        const path = `${user.id}/${assetId}`
        const { data: signed, error: signError } = await supabase.storage
          .from("project-assets")
          .createSignedUrl(path, 60 * 60 * 24 * 7)
        if (!signError && signed?.signedUrl) urls[assetId] = signed.signedUrl
      }),
    )
  }

  return urls
}

export async function resolveTemplatePreviewUrl(
  previewPath: string | null | undefined,
): Promise<string | null> {
  if (!previewPath) return null
  if (
    previewPath.startsWith("data:") ||
    previewPath.startsWith("http://") ||
    previewPath.startsWith("https://") ||
    previewPath.startsWith("blob:") ||
    previewPath.startsWith("/")
  ) {
    return previewPath
  }
  if (!isSupabaseConfigured()) return previewPath
  const supabase = getSupabase()!
  const { data: signed } = await supabase.storage
    .from("templates")
    .createSignedUrl(previewPath, 60 * 60 * 24 * 7)
  if (signed?.signedUrl) return signed.signedUrl
  const { data } = supabase.storage.from("templates").getPublicUrl(previewPath)
  return data.publicUrl
}

async function withTemplatePreview(
  template: TemplateRecord,
): Promise<TemplateRecord> {
  const normalized = {
    ...template,
    data: normalizeProject(template.data),
  }

  if (normalized.preview_path) {
    const resolved = await resolveTemplatePreviewUrl(normalized.preview_path)
    if (resolved && isUsablePreviewUrl(resolved)) {
      return { ...normalized, preview_url: resolved }
    }
    // Huge data: preview_path — ignore and regenerate below when possible.
  }

  if (isBuiltInSeedId(normalized.id)) {
    const cached = await readSeedPreviewCache(normalized.id)
    if (cached) {
      return {
        ...normalized,
        preview_url: seedPreviewDisplayUrl(cached),
      }
    }
  }

  try {
    const assetUrls = await resolvePreviewAssetUrls(normalized.data)

    if (!isSupabaseConfigured()) {
      const blob = isBuiltInSeedId(normalized.id)
        ? await renderSeedPreviewBlob(normalized.data)
        : await renderTemplatePreviewBlob(normalized.data, { assetUrls })
      if (isBuiltInSeedId(normalized.id)) {
        await writeSeedPreviewCache(normalized.id, blob)
      }
      const preview_url = URL.createObjectURL(blob)
      await local.localUpsertTemplate({
        ...normalized,
        preview_path: normalized.preview_path,
      })
      return { ...normalized, preview_url }
    }

    if (isBuiltInSeedId(normalized.id)) {
      const blob = await renderSeedPreviewBlob(normalized.data)
      await writeSeedPreviewCache(normalized.id, blob)
      return {
        ...normalized,
        preview_url: seedPreviewDisplayUrl(blob),
      }
    }

    // Cloud catalog row missing preview — render once and persist to storage.
    const previewBlob = await renderTemplatePreviewBlob(normalized.data, {
      assetUrls,
    })
    const previewStoragePath = `${normalized.id}/preview.webp`
    const supabase = getSupabase()!
    const { error: uploadError } = await supabase.storage
      .from("templates")
      .upload(previewStoragePath, previewBlob, {
        upsert: true,
        contentType: previewBlob.type || "image/webp",
      })
    if (!uploadError) {
      await supabase
        .from("templates")
        .update({ preview_path: previewStoragePath })
        .eq("id", normalized.id)
      const preview_url = await resolveTemplatePreviewUrl(previewStoragePath)
      if (preview_url) {
        return {
          ...normalized,
          preview_path: previewStoragePath,
          preview_url,
        }
      }
    }

    const preview_url = URL.createObjectURL(previewBlob)
    return { ...normalized, preview_url }
  } catch (err) {
    console.warn("template preview failed", normalized.id, err)
    return normalized
  }
}

/** Resolve storage / IndexedDB previews only — never runs canvas capture. */
async function withCheapTemplatePreview(
  template: TemplateRecord,
): Promise<TemplateRecord> {
  const normalized = {
    ...template,
    data: normalizeProject(template.data),
  }

  if (normalized.preview_path) {
    const resolved = await resolveTemplatePreviewUrl(normalized.preview_path)
    if (resolved && isUsablePreviewUrl(resolved)) {
      return { ...normalized, preview_url: resolved }
    }
  }

  if (isBuiltInSeedId(normalized.id)) {
    const cached = await readSeedPreviewCache(normalized.id)
    if (cached) {
      return {
        ...normalized,
        preview_url: seedPreviewDisplayUrl(cached),
      }
    }
  }

  return normalized
}

async function withTemplatePreviews(
  templates: TemplateRecord[],
): Promise<TemplateRecord[]> {
  // Phase 1: signed URLs + IDB (fast) so admin cards paint immediately.
  const cheap = await Promise.all(
    templates.map((template) => withCheapTemplatePreview(template)),
  )
  // Phase 2: generate missing seed/cloud previews one at a time.
  const out = [...cheap]
  for (let i = 0; i < out.length; i++) {
    if (isUsablePreviewUrl(out[i].preview_url)) continue
    out[i] = await withTemplatePreview(out[i])
  }
  return out
}

/**
 * Attach cheap previews, then generate missing ones and call `onUpdate`
 * as each finishes (for progressive catalog UI).
 */
export async function hydratePublishedTemplatePreviews(
  templates: TemplateRecord[],
  onUpdate?: (template: TemplateRecord) => void,
): Promise<TemplateRecord[]> {
  const cheap = await Promise.all(
    templates.map((template) => withCheapTemplatePreview(template)),
  )
  for (const row of cheap) {
    if (isUsablePreviewUrl(row.preview_url)) onUpdate?.(row)
  }
  const out = [...cheap]
  for (let i = 0; i < out.length; i++) {
    if (isUsablePreviewUrl(out[i].preview_url)) continue
    out[i] = await withTemplatePreview(out[i])
    onUpdate?.(out[i])
  }
  return out
}

/** Always include built-in gallery templates; keep extra published rows from the cloud. */
function mergeWithBuiltInCatalog(
  published: TemplateRecord[],
  hiddenIds: string[] = [],
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

async function listHiddenTemplateIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return local.localListHiddenTemplateIds()
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("catalog_hidden_templates")
    .select("template_id")
  if (error) {
    console.warn("catalog_hidden_templates:", error.message)
    return []
  }
  return (data ?? []).map((row) => row.template_id as string)
}

export async function listPublishedTemplates(): Promise<TemplateRecord[]> {
  const hidden = await listHiddenTemplateIds()
  const withBuiltIns = (rows: TemplateRecord[]) =>
    withTemplatePreviews(mergeWithBuiltInCatalog(rows, hidden))

  if (!isSupabaseConfigured()) {
    return withBuiltIns(await local.localListTemplates())
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("published", true)
    .order("sort_order")
  if (error) {
    console.warn("listPublishedTemplates:", error.message)
    return withBuiltIns([])
  }
  return withBuiltIns((data ?? []) as TemplateRecord[])
}

/** Fast catalog rows (storage/IDB only). Pair with hydratePublishedTemplatePreviews. */
export async function listPublishedTemplatesMeta(): Promise<TemplateRecord[]> {
  const hidden = await listHiddenTemplateIds()
  const merge = (rows: TemplateRecord[]) =>
    Promise.all(
      mergeWithBuiltInCatalog(rows, hidden).map((row) =>
        withCheapTemplatePreview(row),
      ),
    )

  if (!isSupabaseConfigured()) {
    return merge(await local.localListTemplates())
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("published", true)
    .order("sort_order")
  if (error) {
    console.warn("listPublishedTemplatesMeta:", error.message)
    return merge([])
  }
  return merge((data ?? []) as TemplateRecord[])
}

export async function listAllTemplates(): Promise<TemplateRecord[]> {
  const hidden = await listHiddenTemplateIds()
  if (!isSupabaseConfigured()) {
    const rows = await local.localListAllTemplates()
    return withTemplatePreviews(mergeWithBuiltInCatalog(rows, hidden))
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .order("sort_order")
  if (error) throw error
  return withTemplatePreviews(
    mergeWithBuiltInCatalog((data ?? []) as TemplateRecord[], hidden),
  )
}

export async function upsertTemplate(
  template: Omit<TemplateRecord, "id"> & { id?: string },
): Promise<TemplateRecord> {
  if (!isSupabaseConfigured()) return local.localUpsertTemplate(template)
  const supabase = getSupabase()!
  const payload = {
    slug: template.slug,
    title: template.title,
    description: template.description,
    preview_path: template.preview_path,
    data: template.data,
    sort_order: template.sort_order,
    published: template.published,
    updated_at: new Date().toISOString(),
  }
  if (template.id) {
    // Update if it exists; otherwise insert with the given id (new publish)
    const { data: updated, error: updateError } = await supabase
      .from("templates")
      .update(payload)
      .eq("id", template.id)
      .select("*")
      .maybeSingle()
    if (updateError) throw updateError
    if (updated) return updated as TemplateRecord

    const { data: inserted, error: insertError } = await supabase
      .from("templates")
      .insert({ id: template.id, ...payload })
      .select("*")
      .single()
    if (insertError) throw insertError
    return inserted as TemplateRecord
  }
  const { data, error } = await supabase
    .from("templates")
    .insert(payload)
    .select("*")
    .single()
  if (error) throw error
  return data as TemplateRecord
}

function templateIdsToHide(id: string, slug?: string): string[] {
  const seed = builtInCatalogTemplates().find(
    (row) =>
      row.id === id ||
      row.slug === id ||
      (slug != null && (row.slug === slug || row.id === slug)),
  )
  return seed
    ? [...new Set([seed.id, seed.slug, id, ...(slug ? [slug] : [])])]
    : [...new Set([id, ...(slug ? [slug] : [])])]
}

export async function deleteTemplate(id: string, slug?: string): Promise<void> {
  const hideIds = templateIdsToHide(id, slug)
  if (!isSupabaseConfigured()) return local.localDeleteTemplate(id, slug)

  const supabase = getSupabase()!
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (uuid) {
    const { error } = await supabase.from("templates").delete().eq("id", id)
    if (error) throw error
  }
  for (const value of hideIds) {
    const { error } = await supabase.from("templates").delete().eq("slug", value)
    if (error) throw error
  }

  const { error: hideError } = await supabase
    .from("catalog_hidden_templates")
    .upsert(hideIds.map((template_id) => ({ template_id })))
  if (hideError) throw hideError
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || `template-${Date.now()}`
}

/** Publish one of your projects as a catalog template (copies assets into templates/). */
export async function publishProjectAsTemplate(input: {
  projectId: string
  title: string
  description?: string
  published?: boolean
}): Promise<TemplateRecord> {
  const record = await getProject(input.projectId)
  if (!record) throw new Error("Project not found")

  const title = input.title.trim() || record.name
  const description = (input.description ?? "").trim()
  const templateId = crypto.randomUUID()
  const projectData = normalizeProject({
    ...record.data,
    name: title,
  })

  if (!isSupabaseConfigured()) {
    const preview_path = await renderTemplatePreviewDataUrl(projectData, {
      assetUrls: await resolvePreviewAssetUrls(projectData),
    })
    return local.localUpsertTemplate({
      id: templateId,
      slug: `${slugify(title)}-${Date.now()}`,
      title,
      description,
      preview_path,
      data: projectData,
      sort_order: 0,
      published: input.published ?? true,
    })
  }

  const supabase = getSupabase()!
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")

  const assetIds = assetIdsFromProject(projectData)
  const signedUrls = await resolveAssetUrls(assetIds)
  const objectUrls: Record<string, string> = {}
  const revokeLater: string[] = []

  try {
    await Promise.all(
      assetIds.map(async (assetId) => {
        const signed = signedUrls[assetId]
        if (!signed) return
        // One Storage fetch per asset — reuse for template copy + preview.
        const res = await fetch(signed)
        if (!res.ok) return
        const blob = await res.blob()
        const { error: uploadError } = await supabase.storage
          .from("templates")
          .upload(`${templateId}/${assetId}`, blob, {
            upsert: true,
            contentType: blob.type || "image/png",
          })
        if (uploadError) throw uploadError
        const objectUrl = URL.createObjectURL(blob)
        objectUrls[assetId] = objectUrl
        revokeLater.push(objectUrl)
      }),
    )

    let preview_path: string | null = null
    try {
      const previewBlob = await renderTemplatePreviewBlob(projectData, {
        assetUrls: objectUrls,
      })
      const previewStoragePath = `${templateId}/preview.webp`
      const { error: previewError } = await supabase.storage
        .from("templates")
        .upload(previewStoragePath, previewBlob, {
          upsert: true,
          contentType: previewBlob.type || "image/webp",
        })
      if (!previewError) preview_path = previewStoragePath
    } catch {
      preview_path = null
    }

    return upsertTemplate({
      id: templateId,
      slug: `${slugify(title)}-${Date.now()}`,
      title,
      description,
      preview_path,
      data: projectData,
      sort_order: 0,
      published: input.published ?? true,
    })
  } finally {
    for (const url of revokeLater) URL.revokeObjectURL(url)
  }
}

async function remapProjectAssetsFromTemplate(
  templateId: string,
  project: Project,
): Promise<Project> {
  if (!isSupabaseConfigured()) return project

  const supabase = getSupabase()!
  const oldIds = assetIdsFromProject(project)
  const idMap = new Map<string, string>()

  for (const oldId of oldIds) {
    const { data: blob, error } = await supabase.storage
      .from("templates")
      .download(`${templateId}/${oldId}`)
    if (error || !blob) continue
    const newId = crypto.randomUUID()
    await uploadProjectAsset(newId, blob)
    idMap.set(oldId, newId)
  }

  if (idMap.size === 0) return project

  return {
    ...project,
    slides: project.slides.map((slide) => ({
      ...slide,
      background: {
        ...slide.background,
        imageId: slide.background.imageId
          ? (idMap.get(slide.background.imageId) ?? slide.background.imageId)
          : null,
      },
      frames: slide.frames.map((frame) => ({
        ...frame,
        screenshotId: frame.screenshotId
          ? (idMap.get(frame.screenshotId) ?? frame.screenshotId)
          : null,
        screenshotIdB: frame.screenshotIdB
          ? (idMap.get(frame.screenshotIdB) ?? frame.screenshotIdB)
          : null,
      })),
      cliparts: slide.cliparts.map((clipart) => ({
        ...clipart,
        assetId: idMap.get(clipart.assetId) ?? clipart.assetId,
      })),
      lenses: (slide.lenses ?? []).map((lens) => ({
        ...lens,
        lockedImageId: lens.lockedImageId
          ? (idMap.get(lens.lockedImageId) ?? lens.lockedImageId)
          : null,
      })),
    })),
  }
}

export async function cloneTemplateToProject(
  template: TemplateRecord,
): Promise<ProjectRecord> {
  let cloned: Project = {
    ...normalizeProject(template.data),
    name: template.title,
  }

  // Remap layer/slide ids so clones are unique
  const slideIdMap = new Map<string, string>()
  cloned.slides = cloned.slides.map((slide) => {
    const newSlideId = crypto.randomUUID()
    slideIdMap.set(slide.id, newSlideId)
    const layerIdMap = new Map<string, string>()
    const frames = slide.frames.map((frame) => {
      const id = crypto.randomUUID()
      layerIdMap.set(frame.id, id)
      return { ...frame, id }
    })
    const texts = slide.texts.map((text) => {
      const id = crypto.randomUUID()
      layerIdMap.set(text.id, id)
      return { ...text, id }
    })
    const cliparts = slide.cliparts.map((clipart) => {
      const id = crypto.randomUUID()
      layerIdMap.set(clipart.id, id)
      return { ...clipart, id }
    })
    return {
      ...slide,
      id: newSlideId,
      frames,
      texts,
      cliparts,
      layerOrder: slide.layerOrder.map((id) => layerIdMap.get(id) ?? id),
      selectedId: layerIdMap.get(slide.selectedId) ?? frames[0]?.id ?? "",
    }
  })
  cloned.activeSlideId =
    slideIdMap.get(cloned.activeSlideId) ?? cloned.slides[0]?.id ?? ""

  cloned = await remapProjectAssetsFromTemplate(template.id, cloned)
  return createProject(cloned)
}

export async function listPublishedCliparts(): Promise<LibraryClipartRecord[]> {
  if (!isSupabaseConfigured()) return local.localListCliparts()
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("library_cliparts")
    .select("*")
    .eq("published", true)
    .order("sort_order")
  if (error) throw error
  return Promise.all(
    (data ?? []).map((row) => withClipartUrl(row as LibraryClipartRecord)),
  )
}

export async function listAllCliparts(): Promise<LibraryClipartRecord[]> {
  if (!isSupabaseConfigured()) return local.localListAllCliparts()
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("library_cliparts")
    .select("*")
    .order("sort_order")
  if (error) throw error
  return Promise.all(
    (data ?? []).map((row) => withClipartUrl(row as LibraryClipartRecord)),
  )
}

export async function upsertLibraryClipart(input: {
  id?: string
  name: string
  category: string
  sort_order: number
  published: boolean
  file?: File
  storage_path?: string
}): Promise<LibraryClipartRecord> {
  if (!isSupabaseConfigured()) {
    let dataUrl: string | undefined
    if (input.file) {
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(input.file!)
      })
    }
    return local.localUpsertClipart({
      id: input.id,
      name: input.name,
      category: input.category,
      storage_path: input.storage_path ?? "",
      sort_order: input.sort_order,
      published: input.published,
      dataUrl,
    })
  }
  const supabase = getSupabase()!
  let storage_path = input.storage_path ?? ""
  const id = input.id ?? crypto.randomUUID()
  if (input.file) {
    const safeName = input.file.name.replace(/[^\w.\-]+/g, "_")
    storage_path = `${id}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from("cliparts")
      .upload(storage_path, input.file, {
        upsert: true,
        contentType: input.file.type || "image/png",
      })
    if (uploadError) throw uploadError
  }
  const payload = {
    name: input.name,
    category: input.category,
    storage_path,
    sort_order: input.sort_order,
    published: input.published,
  }
  if (input.id) {
    const { data, error } = await supabase
      .from("library_cliparts")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single()
    if (error) throw error
    return withClipartUrl(data as LibraryClipartRecord)
  }
  const { data, error } = await supabase
    .from("library_cliparts")
    .insert({ id, ...payload })
    .select("*")
    .single()
  if (error) throw error
  return withClipartUrl(data as LibraryClipartRecord)
}

export async function deleteLibraryClipart(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return local.localDeleteClipart(id)
  const supabase = getSupabase()!
  const { error } = await supabase.from("library_cliparts").delete().eq("id", id)
  if (error) throw error
}

async function withDemoScreenUrl(
  record: LibraryDemoScreenRecord,
): Promise<LibraryDemoScreenRecord> {
  if (!record.storage_path) return record
  if (record.storage_path.startsWith("data:")) {
    return { ...record, url: record.storage_path }
  }
  return {
    ...record,
    url: await resolveBucketUrl("demo-screens", record.storage_path),
  }
}

async function withBackgroundUrl(
  record: LibraryBackgroundRecord,
): Promise<LibraryBackgroundRecord> {
  if (!record.storage_path) return record
  if (record.storage_path.startsWith("data:")) {
    return { ...record, url: record.storage_path }
  }
  return {
    ...record,
    url: await resolveBucketUrl("backgrounds", record.storage_path),
  }
}

/** Admin-only: list all generated demo phone screens. */
export async function listDemoScreens(): Promise<LibraryDemoScreenRecord[]> {
  if (!isSupabaseConfigured()) return local.localListDemoScreens()
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("library_demo_screens")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return Promise.all(
    (data ?? []).map((row) =>
      withDemoScreenUrl(row as LibraryDemoScreenRecord),
    ),
  )
}

export async function publishDemoScreens(input: {
  name: string
  prompt: string
  aspect: DemoAspect
  files: File[]
}): Promise<LibraryDemoScreenRecord[]> {
  if (!input.files.length) throw new Error("No images to publish")
  if (!isSupabaseConfigured()) {
    return local.localPublishDemoScreens(input)
  }
  const supabase = getSupabase()!
  const batch_id = crypto.randomUUID()
  const rows: LibraryDemoScreenRecord[] = []
  for (let i = 0; i < input.files.length; i += 1) {
    const file = input.files[i]!
    const id = crypto.randomUUID()
    const safeName = file.name.replace(/[^\w.\-]+/g, "_")
    const storage_path = `${batch_id}/${id}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from("demo-screens")
      .upload(storage_path, file, {
        upsert: true,
        contentType: file.type || "image/webp",
      })
    if (uploadError) throw uploadError
    const payload = {
      id,
      name: input.files.length > 1 ? `${input.name} ${i + 1}` : input.name,
      prompt: input.prompt,
      aspect: input.aspect,
      batch_id,
      storage_path,
      sort_order: i,
    }
    const { data, error } = await supabase
      .from("library_demo_screens")
      .insert(payload)
      .select("*")
      .single()
    if (error) throw error
    rows.push(await withDemoScreenUrl(data as LibraryDemoScreenRecord))
  }
  return rows
}

export async function deleteDemoScreen(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return local.localDeleteDemoScreen(id)
  const supabase = getSupabase()!
  const { data } = await supabase
    .from("library_demo_screens")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle()
  if (data?.storage_path) {
    await supabase.storage.from("demo-screens").remove([data.storage_path])
  }
  const { error } = await supabase
    .from("library_demo_screens")
    .delete()
    .eq("id", id)
  if (error) throw error
}

export async function listPublishedBackgrounds(): Promise<
  LibraryBackgroundRecord[]
> {
  if (!isSupabaseConfigured()) return local.localListPublishedBackgrounds()
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("library_backgrounds")
    .select("*")
    .eq("published", true)
    .order("sort_order")
  if (error) throw error
  return Promise.all(
    (data ?? []).map((row) =>
      withBackgroundUrl(row as LibraryBackgroundRecord),
    ),
  )
}

export async function listAllBackgrounds(): Promise<LibraryBackgroundRecord[]> {
  if (!isSupabaseConfigured()) return local.localListAllBackgrounds()
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("library_backgrounds")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return Promise.all(
    (data ?? []).map((row) =>
      withBackgroundUrl(row as LibraryBackgroundRecord),
    ),
  )
}

export async function upsertLibraryBackground(input: {
  id?: string
  name: string
  prompt?: string
  sort_order?: number
  published: boolean
  file?: File
  storage_path?: string
}): Promise<LibraryBackgroundRecord> {
  if (!isSupabaseConfigured()) {
    return local.localUpsertBackground(input)
  }
  const supabase = getSupabase()!
  let storage_path = input.storage_path ?? ""
  const id = input.id ?? crypto.randomUUID()
  if (input.file) {
    const safeName = input.file.name.replace(/[^\w.\-]+/g, "_")
    storage_path = `${id}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from("backgrounds")
      .upload(storage_path, input.file, {
        upsert: true,
        contentType: input.file.type || "image/webp",
      })
    if (uploadError) throw uploadError
  }
  const payload = {
    name: input.name,
    prompt: input.prompt ?? "",
    storage_path,
    sort_order: input.sort_order ?? 0,
    published: input.published,
  }
  if (input.id) {
    const { data, error } = await supabase
      .from("library_backgrounds")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single()
    if (error) throw error
    return withBackgroundUrl(data as LibraryBackgroundRecord)
  }
  const { data, error } = await supabase
    .from("library_backgrounds")
    .insert({ id, ...payload })
    .select("*")
    .single()
  if (error) throw error
  return withBackgroundUrl(data as LibraryBackgroundRecord)
}

export async function deleteLibraryBackground(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return local.localDeleteBackground(id)
  const supabase = getSupabase()!
  const { data } = await supabase
    .from("library_backgrounds")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle()
  if (data?.storage_path) {
    await supabase.storage.from("backgrounds").remove([data.storage_path])
  }
  const { error } = await supabase
    .from("library_backgrounds")
    .delete()
    .eq("id", id)
  if (error) throw error
}
