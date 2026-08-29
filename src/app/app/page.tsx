import type { Metadata } from "next"
import { RequireAuth } from "@/components/RequireAuth"
import { ProjectsPage } from "@/views/ProjectsPage"

export const metadata: Metadata = {
  title: "Projects",
  robots: { index: false, follow: false },
}

export default function AppProjectsRoute() {
  return (
    <RequireAuth>
      <div className="h-full min-h-screen">
        <ProjectsPage />
      </div>
    </RequireAuth>
  )
}
