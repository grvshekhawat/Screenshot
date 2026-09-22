"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "../auth/AuthProvider"
import { Editor } from "../components/Editor"
import { ProjectProvider, useProject } from "../project-store"

function EditorChrome({ promptUploadFirst }: { promptUploadFirst: boolean }) {
  const router = useRouter()
  const { flushSave, saveState, hasUnsavedChanges } = useProject()
  const [leaving, setLeaving] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const pendingPath = useRef<string | null>(null)

  const closeLeaveDialog = () => {
    if (leaving) return
    setLeaveOpen(false)
    setSaveError(null)
    pendingPath.current = null
  }

  const goTo = (path: string) => {
    if (leaving || saveState === "saving") return
    if (!hasUnsavedChanges()) {
      router.push(path)
      return
    }
    pendingPath.current = path
    setSaveError(null)
    setLeaveOpen(true)
  }

  const saveAndLeave = async () => {
    setLeaving(true)
    setSaveError(null)
    try {
      await flushSave()
      const path = pendingPath.current
      setLeaveOpen(false)
      pendingPath.current = null
      if (path) router.push(path)
    } catch (err) {
      console.error(err)
      setSaveError("Could not save. Use Save draft, then try leaving again.")
    } finally {
      setLeaving(false)
    }
  }

  const discardAndLeave = () => {
    const path = pendingPath.current
    setLeaveOpen(false)
    pendingPath.current = null
    if (path) router.push(path)
  }

  useEffect(() => {
    if (!leaveOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLeaveDialog()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [leaveOpen, leaving])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#07070a] px-3 text-[11px] text-zinc-500">
        <button
          type="button"
          disabled={leaving || saveState === "saving"}
          onClick={() => goTo("/app")}
          className="hover:text-white disabled:opacity-50"
        >
          {leaving ? "Saving…" : "← Projects"}
        </button>
        <button
          type="button"
          disabled={leaving || saveState === "saving"}
          onClick={() => goTo("/pricing")}
          className="hover:text-white disabled:opacity-50"
        >
          Pricing
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <Editor promptUploadFirst={promptUploadFirst} />
      </div>
      {leaveOpen ? (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={closeLeaveDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-dialog-title"
            className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a0a0e] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="leave-dialog-title"
              className="text-sm font-semibold text-zinc-100"
            >
              Unsaved changes
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              Save before leaving, or discard recent edits.
            </p>
            {saveError ? (
              <p className="mt-2 text-xs text-red-400">{saveError}</p>
            ) : null}
            <div className="mt-4 flex flex-col gap-1.5">
              <button
                type="button"
                disabled={leaving}
                onClick={() => void saveAndLeave()}
                className="rounded-md bg-[#e8ff47] px-3 py-2 text-xs font-semibold text-[#0a0a0c] hover:bg-[#f1ff7a] disabled:opacity-50"
              >
                {leaving ? "Saving…" : "Save and leave"}
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={discardAndLeave}
                className="rounded-md border border-white/10 bg-[#121218] px-3 py-2 text-xs text-zinc-200 hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-50"
              >
                Leave without saving
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={closeLeaveDialog}
                className="rounded-md px-3 py-2 text-xs text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200 disabled:opacity-50"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function EditorPage() {
  const params = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const projectId = params.projectId
  const { ready, userId } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (ready && !userId) router.replace("/login")
    else if (!projectId) router.replace("/app")
  }, [ready, userId, projectId, router])

  if (!ready || !userId || !projectId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07070a] text-sm text-zinc-400">
        Loading…
      </div>
    )
  }

  const promptUploadFirst = searchParams.get("uploadFirst") === "1"

  return (
    <ProjectProvider projectId={projectId}>
      <EditorChrome promptUploadFirst={promptUploadFirst} />
    </ProjectProvider>
  )
}
