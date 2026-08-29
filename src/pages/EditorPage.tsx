import { useState } from "react"
import { Navigate, useNavigate, useParams, Link } from "react-router-dom"
import { useAuth } from "../auth/AuthProvider"
import { Editor } from "../components/Editor"
import { ProjectProvider, useProject } from "../project-store"

function EditorChrome() {
  const navigate = useNavigate()
  const { flushSave, saveState } = useProject()
  const [leaving, setLeaving] = useState(false)

  const goToProjects = async () => {
    if (leaving) return
    setLeaving(true)
    try {
      await flushSave()
    } catch (err) {
      console.error(err)
    }
    navigate("/app")
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-zinc-900 bg-zinc-950 px-3 text-[11px] text-zinc-500">
        <button
          type="button"
          disabled={leaving || saveState === "saving"}
          onClick={() => void goToProjects()}
          className="hover:text-white disabled:opacity-50"
        >
          {leaving ? "Saving…" : "← Projects"}
        </button>
        <Link to="/pricing" className="hover:text-white">
          Pricing
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <Editor />
      </div>
    </div>
  )
}

export function EditorPage() {
  const { projectId } = useParams()
  const { ready, userId } = useAuth()

  if (ready && !userId) return <Navigate to="/login" replace />
  if (!projectId) return <Navigate to="/app" replace />

  return (
    <ProjectProvider projectId={projectId}>
      <EditorChrome />
    </ProjectProvider>
  )
}
