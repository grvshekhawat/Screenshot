import { Navigate, useParams, Link } from "react-router-dom"
import { useAuth } from "../auth/AuthProvider"
import { Editor } from "../components/Editor"
import { ProjectProvider } from "../project-store"

export function EditorPage() {
  const { projectId } = useParams()
  const { ready, userId } = useAuth()

  if (ready && !userId) return <Navigate to="/login" replace />
  if (!projectId) return <Navigate to="/app" replace />

  return (
    <ProjectProvider projectId={projectId}>
      <div className="flex h-full flex-col">
        <div className="flex h-9 shrink-0 items-center gap-3 border-b border-zinc-900 bg-zinc-950 px-3 text-[11px] text-zinc-500">
          <Link to="/app" className="hover:text-white">
            ← Projects
          </Link>
          <Link to="/pricing" className="hover:text-white">
            Pricing
          </Link>
        </div>
        <div className="min-h-0 flex-1">
          <Editor />
        </div>
      </div>
    </ProjectProvider>
  )
}
