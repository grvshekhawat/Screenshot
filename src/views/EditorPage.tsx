"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "../auth/AuthProvider"
import { Editor } from "../components/Editor"
import { ProjectProvider, useProject } from "../project-store"

function EditorChrome() {
  const router = useRouter()
  const { flushSave, saveState, hasUnsavedChanges } = useProject()
  const [leaving, setLeaving] = useState(false)

  const confirmBeforeLeave = async (): Promise<"stay" | "saved" | "discarded"> => {
    if (!hasUnsavedChanges()) return "saved"
    const save = window.confirm(
      "You have unsaved changes.\n\nOK — Save and leave\nCancel — More options",
    )
    if (save) {
      setLeaving(true)
      try {
        await flushSave()
        return "saved"
      } catch (err) {
        console.error(err)
        window.alert("Could not save. Use Save draft, then try leaving again.")
        return "stay"
      } finally {
        setLeaving(false)
      }
    }
    const discard = window.confirm(
      "Leave without saving? Your recent changes will be lost.",
    )
    return discard ? "discarded" : "stay"
  }

  const goTo = async (path: string) => {
    if (leaving || saveState === "saving") return
    const outcome = await confirmBeforeLeave()
    if (outcome === "stay") return
    router.push(path)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#07070a] px-3 text-[11px] text-zinc-500">
        <button
          type="button"
          disabled={leaving || saveState === "saving"}
          onClick={() => void goTo("/app")}
          className="hover:text-white disabled:opacity-50"
        >
          {leaving ? "Saving…" : "← Projects"}
        </button>
        <button
          type="button"
          disabled={leaving || saveState === "saving"}
          onClick={() => void goTo("/pricing")}
          className="hover:text-white disabled:opacity-50"
        >
          Pricing
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <Editor />
      </div>
    </div>
  )
}

export function EditorPage() {
  const params = useParams<{ projectId: string }>()
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

  return (
    <ProjectProvider projectId={projectId}>
      <EditorChrome />
    </ProjectProvider>
  )
}
