import { get, set } from "idb-keyval"
import { assetIdsFromProject } from "../assets"
import { normalizeProject } from "../constants"
import { MAX_CLOUD_PROJECTS } from "../config"
import {
  CATALOG_SEED_VERSION,
  SEED_TEMPLATE_SPECS,
} from "../sample-templates"
import { builtInSampleScreens, sampleScreenDataUrl } from "../sample-screens"
import { renderProjectPreviewDataUrl } from "../template-preview"
import type {
  LibraryClipartRecord,
  Profile,
  ProjectRecord,
  TemplateRecord,
} from "../types/cloud"
import type { Project } from "../types"

const LS_USER = "ss:local-user"
const LS_PROFILE = "ss:local-profile"
/** Large payloads live in IndexedDB (localStorage ~5MB quota is too small). */
const LS_PROJECTS = "ss:local-projects"
const LS_ASSETS = "ss:local-assets"
const LS_TEMPLATES = "ss:local-templates"
const LS_CLIPARTS = "ss:local-cliparts"
const LS_CATALOG_SEED = "ss:catalog-seed-v"
const LS_HIDDEN_TEMPLATES = "ss:hidden-templates"

const IDB_PREFIX = "ss-idb:"

function uid(): string {
  return crypto.randomUUID()
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeLocalJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function idbKey(key: string): string {
  return `${IDB_PREFIX}${key}`
}

function clearLocalKey(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/** Read from IndexedDB; one-time migrate from legacy localStorage. */
async function readStore<T>(key: string, fallback: T): Promise<T> {
  try {
    const fromIdb = await get<T>(idbKey(key))
    if (fromIdb !== undefined && fromIdb !== null) return fromIdb
  } catch {
    // Fall through to localStorage.
  }

  const hadLocal = localStorage.getItem(key) !== null
  const fromLocal = readLocalJson<T>(key, fallback)
  if (hadLocal) {
    try {
      await set(idbKey(key), fromLocal)
      clearLocalKey(key)
    } catch {
      // Keep serving local copy if migrate fails.
    }
    return fromLocal
  }
  return fallback
}

async function writeStore(key: string, value: unknown): Promise<void> {
  await set(idbKey(key), value)
  clearLocalKey(key)
}

/** Drop legacy localStorage copies only after IndexedDB already has the data. */
export async function localPurgeLegacyStorage(): Promise<void> {
  for (const key of [LS_PROJECTS, LS_ASSETS, LS_TEMPLATES, LS_CLIPARTS]) {
    try {
      const fromIdb = await get(idbKey(key))
      if (fromIdb !== undefined && fromIdb !== null) clearLocalKey(key)
    } catch {
      // ignore
    }
  }
}

export function localIsLoggedIn(): boolean {
  return Boolean(localStorage.getItem(LS_USER))
}

export function localGetUserId(): string | null {
  return localStorage.getItem(LS_USER)
}

export async function localSignIn(email: string): Promise<Profile> {
  const id = localStorage.getItem(LS_USER) ?? uid()
  localStorage.setItem(LS_USER, id)
  const existing = readLocalJson<Profile | null>(LS_PROFILE, null)
  const profile: Profile = existing?.id === id
    ? { ...existing, email }
    : {
        id,
        email,
        role: email.endsWith("@admin.local") ? "admin" : "user",
        subscription_status: "none",
        subscription_period_end: null,
        billing_provider: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        paypal_subscriber_id: null,
        paypal_subscription_id: null,
      }
  writeLocalJson(LS_PROFILE, profile)
  await seedCatalogIfNeeded()
  await localPurgeLegacyStorage()
  return profile
}

export async function localSignOut(): Promise<void> {
  localStorage.removeItem(LS_USER)
}

export async function localGetProfile(): Promise<Profile | null> {
  if (!localIsLoggedIn()) return null
  return readLocalJson<Profile | null>(LS_PROFILE, null)
}

export async function localUpdateProfile(
  patch: Partial<Profile>,
): Promise<Profile> {
  const current = await localGetProfile()
  if (!current) throw new Error("Not signed in")
  const next = { ...current, ...patch }
  writeLocalJson(LS_PROFILE, next)
  return next
}

export async function localListProjects(): Promise<ProjectRecord[]> {
  const userId = localGetUserId()
  if (!userId) return []
  // Migrate oversized localStorage → IndexedDB, then drop legacy copies.
  const all = await readStore<ProjectRecord[]>(LS_PROJECTS, [])
  await localPurgeLegacyStorage()
  return all
    .filter((p) => p.user_id === userId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function localGetProject(id: string): Promise<ProjectRecord | null> {
  const all = await readStore<ProjectRecord[]>(LS_PROJECTS, [])
  return all.find((p) => p.id === id) ?? null
}

export async function localCreateProject(
  project: Project,
): Promise<ProjectRecord> {
  const userId = localGetUserId()
  if (!userId) throw new Error("Not signed in")
  const all = await readStore<ProjectRecord[]>(LS_PROJECTS, [])
  const mine = all.filter((p) => p.user_id === userId)
  const profile = await localGetProfile()
  if (profile?.role !== "admin" && mine.length >= MAX_CLOUD_PROJECTS) {
    throw new Error(
      `Project limit reached (${MAX_CLOUD_PROJECTS}). Delete a project to create another.`,
    )
  }
  const now = new Date().toISOString()
  const data = normalizeProject(project)
  let thumbnail_path: string | null = null
  try {
    thumbnail_path = await renderProjectPreviewDataUrl(data, {
      assetUrls: await localPreviewAssetUrls(data),
    })
  } catch {
    thumbnail_path = null
  }
  const record: ProjectRecord = {
    id: uid(),
    user_id: userId,
    name: project.name,
    target_id: project.targetId,
    data,
    thumbnail_path,
    created_at: now,
    updated_at: now,
  }
  await writeStore(LS_PROJECTS, [...all, record])
  return record
}

export async function localSaveProject(
  id: string,
  project: Project,
): Promise<ProjectRecord> {
  const all = await readStore<ProjectRecord[]>(LS_PROJECTS, [])
  const index = all.findIndex((p) => p.id === id)
  if (index < 0) throw new Error("Project not found")
  const userId = localGetUserId()
  if (all[index].user_id !== userId) throw new Error("Forbidden")
  const data = normalizeProject(project)
  let thumbnail_path: string | null = all[index].thumbnail_path
  try {
    thumbnail_path = await renderProjectPreviewDataUrl(data, {
      assetUrls: await localPreviewAssetUrls(data),
    })
  } catch {
    // Keep previous thumbnail if render fails.
  }
  const updated: ProjectRecord = {
    ...all[index],
    name: project.name,
    target_id: project.targetId,
    data,
    thumbnail_path,
    updated_at: new Date().toISOString(),
  }
  all[index] = updated
  await writeStore(LS_PROJECTS, all)
  return updated
}

export async function localDeleteProject(id: string): Promise<void> {
  const userId = localGetUserId()
  const all = await readStore<ProjectRecord[]>(LS_PROJECTS, [])
  await writeStore(
    LS_PROJECTS,
    all.filter((p) => !(p.id === id && p.user_id === userId)),
  )
}

export async function localSaveAsset(
  assetId: string,
  blob: Blob,
): Promise<string> {
  const userId = localGetUserId()
  if (!userId) throw new Error("Not signed in")
  const dataUrl = await blobToDataUrl(blob)
  const assets = await readStore<Record<string, string>>(LS_ASSETS, {})
  assets[`${userId}:${assetId}`] = dataUrl
  await writeStore(LS_ASSETS, assets)
  return dataUrl
}

export async function localLoadAsset(assetId: string): Promise<string | null> {
  const assets = await readStore<Record<string, string>>(LS_ASSETS, {})
  const userId = localGetUserId()
  if (userId) {
    const owned = assets[`${userId}:${assetId}`]
    if (owned) return owned
  }
  const shared = assets[`shared:${assetId}`]
  if (shared) return shared
  return sampleScreenDataUrl(assetId)
}

async function localPreviewAssetUrls(
  project: Project,
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}
  await Promise.all(
    assetIdsFromProject(project).map(async (id) => {
      const url = await localLoadAsset(id)
      if (url) urls[id] = url
    }),
  )
  return urls
}

export async function localListTemplates(): Promise<TemplateRecord[]> {
  await seedCatalogIfNeeded()
  return (await readStore<TemplateRecord[]>(LS_TEMPLATES, [])).filter(
    (t) => t.published,
  )
}

export async function localListAllTemplates(): Promise<TemplateRecord[]> {
  await seedCatalogIfNeeded()
  return readStore<TemplateRecord[]>(LS_TEMPLATES, [])
}

export async function localUpsertTemplate(
  template: Omit<TemplateRecord, "id"> & { id?: string },
): Promise<TemplateRecord> {
  const all = await readStore<TemplateRecord[]>(LS_TEMPLATES, [])
  if (template.id) {
    const index = all.findIndex((t) => t.id === template.id)
    if (index >= 0) {
      all[index] = { ...all[index], ...template, id: template.id }
      await writeStore(LS_TEMPLATES, all)
      return all[index]
    }
  }
  const record: TemplateRecord = {
    id: template.id ?? uid(),
    slug: template.slug,
    title: template.title,
    description: template.description,
    preview_path: template.preview_path,
    data: template.data,
    sort_order: template.sort_order,
    published: template.published,
  }
  await writeStore(LS_TEMPLATES, [...all, record])
  return record
}

export async function localDeleteTemplate(
  id: string,
  slug?: string,
): Promise<void> {
  const seed = SEED_TEMPLATE_SPECS.find(
    (row) =>
      row.id === id ||
      row.slug === id ||
      (slug != null && (row.slug === slug || row.id === slug)),
  )
  const hideIds = new Set(
    seed ? [seed.id, seed.slug, id, ...(slug ? [slug] : [])] : [id, ...(slug ? [slug] : [])],
  )
  const all = await readStore<TemplateRecord[]>(LS_TEMPLATES, [])
  await writeStore(
    LS_TEMPLATES,
    all.filter((t) => !hideIds.has(t.id) && !hideIds.has(t.slug)),
  )
  const hidden = localListHiddenTemplateIds()
  localStorage.setItem(
    LS_HIDDEN_TEMPLATES,
    JSON.stringify([...new Set([...hidden, ...hideIds])]),
  )
}

export function localListHiddenTemplateIds(): string[] {
  return readLocalJson<string[]>(LS_HIDDEN_TEMPLATES, [])
}

export async function localListCliparts(): Promise<LibraryClipartRecord[]> {
  await seedCatalogIfNeeded()
  const all = await readStore<LibraryClipartRecord[]>(LS_CLIPARTS, [])
  return Promise.all(
    all
      .filter((c) => c.published)
      .map(async (c) => ({ ...c, url: await resolveClipartUrl(c) })),
  )
}

export async function localListAllCliparts(): Promise<LibraryClipartRecord[]> {
  await seedCatalogIfNeeded()
  const all = await readStore<LibraryClipartRecord[]>(LS_CLIPARTS, [])
  return Promise.all(
    all.map(async (c) => ({ ...c, url: await resolveClipartUrl(c) })),
  )
}

export async function localUpsertClipart(
  clipart: Omit<LibraryClipartRecord, "id" | "url"> & {
    id?: string
    dataUrl?: string
  },
): Promise<LibraryClipartRecord> {
  const all = await readStore<LibraryClipartRecord[]>(LS_CLIPARTS, [])
  const id = clipart.id ?? uid()
  if (clipart.dataUrl) {
    const assets = await readStore<Record<string, string>>(LS_ASSETS, {})
    assets[`shared:${id}`] = clipart.dataUrl
    await writeStore(LS_ASSETS, assets)
  }
  const record: LibraryClipartRecord = {
    id,
    name: clipart.name,
    category: clipart.category,
    storage_path: clipart.storage_path || `shared:${id}`,
    sort_order: clipart.sort_order,
    published: clipart.published,
  }
  const index = all.findIndex((c) => c.id === id)
  if (index >= 0) all[index] = record
  else all.push(record)
  await writeStore(LS_CLIPARTS, all)
  return { ...record, url: await resolveClipartUrl(record) }
}

export async function localDeleteClipart(id: string): Promise<void> {
  const all = await readStore<LibraryClipartRecord[]>(LS_CLIPARTS, [])
  await writeStore(
    LS_CLIPARTS,
    all.filter((c) => c.id !== id),
  )
}

async function resolveClipartUrl(
  c: LibraryClipartRecord,
): Promise<string | undefined> {
  if (c.storage_path.startsWith("/") || c.storage_path.startsWith("http")) {
    return c.storage_path
  }
  const assets = await readStore<Record<string, string>>(LS_ASSETS, {})
  return assets[c.storage_path] ?? assets[`shared:${c.id}`]
}

export async function localLoadLibraryClipartUrl(
  libraryId: string,
): Promise<string | null> {
  await seedCatalogIfNeeded()
  const all = await readStore<LibraryClipartRecord[]>(LS_CLIPARTS, [])
  const record = all.find((item) => item.id === libraryId)
  if (!record) return null
  return (await resolveClipartUrl(record)) ?? null
}

async function seedCatalogIfNeeded() {
  await ensureSampleScreenshotAssets()

  const seedVersion = Number(localStorage.getItem(LS_CATALOG_SEED) || "0")
  if (seedVersion < CATALOG_SEED_VERSION) {
    await upsertSeedTemplates()
    localStorage.setItem(LS_CATALOG_SEED, String(CATALOG_SEED_VERSION))
  } else {
    const templates = await readStore<TemplateRecord[]>(LS_TEMPLATES, [])
    if (templates.length === 0) {
      await upsertSeedTemplates()
    }
  }

  const cliparts = await readStore<LibraryClipartRecord[]>(LS_CLIPARTS, [])
  if (cliparts.length === 0) {
    const svg = (label: string, fill: string) =>
      `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="48" fill="${fill}"/><text x="128" y="140" text-anchor="middle" fill="white" font-size="36" font-family="sans-serif">${label}</text></svg>`,
      )}`
    const seeded: LibraryClipartRecord[] = [
      {
        id: uid(),
        name: "Burst",
        category: "shapes",
        storage_path: "",
        sort_order: 0,
        published: true,
      },
      {
        id: uid(),
        name: "Badge",
        category: "shapes",
        storage_path: "",
        sort_order: 1,
        published: true,
      },
      {
        id: uid(),
        name: "Star",
        category: "shapes",
        storage_path: "",
        sort_order: 2,
        published: true,
      },
    ]
    const assets = await readStore<Record<string, string>>(LS_ASSETS, {})
    const fills = ["#7c3aed", "#ea580c", "#0891b2"]
    seeded.forEach((item, i) => {
      item.storage_path = `shared:${item.id}`
      assets[item.storage_path] = svg(item.name, fills[i]!)
    })
    await writeStore(LS_ASSETS, assets)
    await writeStore(LS_CLIPARTS, seeded)
  } else {
    await removeBuiltInGestureCliparts(cliparts)
  }
}

async function ensureSampleScreenshotAssets() {
  const assets = await readStore<Record<string, string>>(LS_ASSETS, {})
  let changed = false
  for (const screen of builtInSampleScreens()) {
    const key = `shared:${screen.id}`
    if (assets[key] !== screen.dataUrl) {
      assets[key] = screen.dataUrl
      changed = true
    }
  }
  if (changed) await writeStore(LS_ASSETS, assets)
}

async function upsertSeedTemplates() {
  const existing = await readStore<TemplateRecord[]>(LS_TEMPLATES, [])
  const seedIds = new Set(SEED_TEMPLATE_SPECS.map((spec) => spec.id))
  const custom = existing.filter((item) => !seedIds.has(item.id))
  const seeded: TemplateRecord[] = SEED_TEMPLATE_SPECS.map((spec) => ({
    id: spec.id,
    slug: spec.slug,
    title: spec.title,
    description: spec.description,
    preview_path: null,
    data: spec.build(),
    sort_order: spec.sort_order,
    published: true,
  }))
  await writeStore(LS_TEMPLATES, [...seeded, ...custom])
}

const BUILT_IN_GESTURE_IDS = new Set([
  "gesture-hold-left",
  "gesture-hold-right",
  "gesture-point",
  "gesture-tap",
])

async function removeBuiltInGestureCliparts(existing: LibraryClipartRecord[]) {
  const next = existing.filter((item) => !BUILT_IN_GESTURE_IDS.has(item.id))
  if (next.length === existing.length) return
  await writeStore(LS_CLIPARTS, next)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Failed to read file"))
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(blob)
  })
}
