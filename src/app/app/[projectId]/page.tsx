import type { Metadata } from "next"
import { RequireAuth } from "@/components/RequireAuth"
import { EditorPage } from "@/views/EditorPage"

export const metadata: Metadata = {
  title: "Editor",
  robots: { index: false, follow: false },
}

export default function EditorRoute() {
  return (
    <RequireAuth>
      <div className="h-screen">
        <EditorPage />
      </div>
    </RequireAuth>
  )
}
