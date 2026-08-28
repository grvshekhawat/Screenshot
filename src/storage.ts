import { del, get, set } from "idb-keyval"
import { createSampleProject, normalizeProject } from "./constants"
import type { Project } from "./types"

const PROJECT_KEY = "screenshot-studio:project"
const SHOT_PREFIX = "screenshot-studio:shot:"

export async function loadProject(): Promise<Project> {
  const stored = await get<Project>(PROJECT_KEY)
  if (stored?.slides?.length) return normalizeProject(stored)
  return createSampleProject()
}

export async function saveProject(project: Project): Promise<void> {
  await set(PROJECT_KEY, project)
}

export async function saveScreenshot(id: string, blob: Blob): Promise<void> {
  await set(SHOT_PREFIX + id, blob)
}

export async function loadScreenshot(id: string): Promise<Blob | undefined> {
  return get<Blob>(SHOT_PREFIX + id)
}

export async function deleteScreenshot(id: string): Promise<void> {
  await del(SHOT_PREFIX + id)
}
