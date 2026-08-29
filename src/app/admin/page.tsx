import type { Metadata } from "next"
import { RequireAuth } from "@/components/RequireAuth"
import { AdminPage } from "@/views/AdminPage"

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
}

export default function AdminRoute() {
  return (
    <RequireAuth>
      <div className="h-full min-h-screen">
        <AdminPage />
      </div>
    </RequireAuth>
  )
}
