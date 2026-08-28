import { isSupabaseConfigured } from "../config"
import { assetIdsFromProject } from "../assets"
import { createSampleProject, normalizeProject } from "../constants"
import { getSupabase } from "../lib/supabase"
import {
  renderProjectPreviewBlob,
  renderProjectPreviewDataUrl,
  renderTemplatePreviewBlob,
  renderTemplatePreviewDataUrl,
} from "../template-preview"
import type {
  LibraryClipartRecord,
  Profile,
  ProjectRecord,
  TemplateRecord,
} from "../types/cloud"
import type { Project } from "../types"
import * as local from "./local-backend"

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
  await Promise.all(
    assetIdsFromProject(project).map(async (id) => {
      const url = await resolveAssetUrl(id)
      if (url) urls[id] = url
    }),
  )
  return urls
}

async function withProjectThumbnail(
  project: ProjectRecord,
): Promise<ProjectRecord> {
  try {
    const data = normalizeProject(project.data)
    const thumbnail_url = await renderProjectPreviewDataUrl(data, {
      assetUrls: await resolvePreviewAssetUrls(data),
    })
    return {
      ...project,
      thumbnail_path: project.thumbnail_path ?? thumbnail_url,
      thumbnail_url,
    }
  } catch {
    if (project.thumbnail_path) {
      const thumbnail_url = await resolveProjectThumbnailUrl(
        project.thumbnail_path,
      )
      if (thumbnail_url) return { ...project, thumbnail_url }
    }
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
      return await renderProjectPreviewDataUrl(data, { assetUrls })
    }
    const supabase = getSupabase()!
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const blob = await renderProjectPreviewBlob(data, { assetUrls })
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
  const supabase = getSupabase()!
  const { data: signed } = await supabase.storage
    .from("cliparts")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
  if (signed?.signedUrl) return signed.signedUrl
  const { data } = supabase.storage.from("cliparts").getPublicUrl(storagePath)
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
  if (error) throw error
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
  if (assetId.startsWith("library:")) {
    const libraryId = assetId.slice("library:".length)
    if (!isSupabaseConfigured()) {
      return local.localLoadLibraryClipartUrl(libraryId)
    }
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from("library_cliparts")
      .select("storage_path")
      .eq("id", libraryId)
      .maybeSingle()
    if (error || !data?.storage_path) return null
    return resolveClipartUrl(data.storage_path as string)
  }

  if (!isSupabaseConfigured()) return local.localLoadAsset(assetId)
  const supabase = getSupabase()!
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const path = `${user.id}/${assetId}`
  const { data: signed, error } = await supabase.storage
    .from("project-assets")
    .createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error || !signed?.signedUrl) return null
  return signed.signedUrl
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

  try {
    // Always render from slide data so multi-slide strip stays current.
    const preview_url = await renderTemplatePreviewDataUrl(normalized.data, {
      assetUrls: await resolvePreviewAssetUrls(normalized.data),
    })
    if (!isSupabaseConfigured()) {
      const needsPersist =
        !normalized.preview_path ||
        !normalized.preview_path.startsWith("data:image/")
      if (needsPersist || normalized.preview_path !== preview_url) {
        // Refresh local cached preview (cheap; few templates).
        await local.localUpsertTemplate({
          ...normalized,
          preview_path: preview_url,
        })
      }
      return { ...normalized, preview_path: preview_url, preview_url }
    }
    return { ...normalized, preview_url }
  } catch {
    if (normalized.preview_path) {
      const preview_url = await resolveTemplatePreviewUrl(normalized.preview_path)
      if (preview_url) return { ...normalized, preview_url }
    }
    return normalized
  }
}

async function withTemplatePreviews(
  templates: TemplateRecord[],
): Promise<TemplateRecord[]> {
  return Promise.all(templates.map((template) => withTemplatePreview(template)))
}

export async function listPublishedTemplates(): Promise<TemplateRecord[]> {
  if (!isSupabaseConfigured()) {
    return withTemplatePreviews(await local.localListTemplates())
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("published", true)
    .order("sort_order")
  if (error) throw error
  return withTemplatePreviews((data ?? []) as TemplateRecord[])
}

export async function listAllTemplates(): Promise<TemplateRecord[]> {
  if (!isSupabaseConfigured()) {
    return withTemplatePreviews(await local.localListAllTemplates())
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .order("sort_order")
  if (error) throw error
  return withTemplatePreviews((data ?? []) as TemplateRecord[])
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

export async function deleteTemplate(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return local.localDeleteTemplate(id)
  const supabase = getSupabase()!
  const { error } = await supabase.from("templates").delete().eq("id", id)
  if (error) throw error
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
  for (const assetId of assetIds) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from("project-assets")
      .download(`${user.id}/${assetId}`)
    if (downloadError || !blob) continue
    const { error: uploadError } = await supabase.storage
      .from("templates")
      .upload(`${templateId}/${assetId}`, blob, {
        upsert: true,
        contentType: blob.type || "image/png",
      })
    if (uploadError) throw uploadError
  }

  let preview_path: string | null = null
  try {
    const previewBlob = await renderTemplatePreviewBlob(projectData, {
      assetUrls: await resolvePreviewAssetUrls(projectData),
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
