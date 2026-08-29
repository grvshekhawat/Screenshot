import type { ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider, useAuth } from "./auth/AuthProvider"
import { AdminPage } from "./pages/AdminPage"
import { EditorPage } from "./pages/EditorPage"
import { HomePage } from "./pages/HomePage"
import { LegalPage } from "./pages/LegalPage"
import { LoginPage } from "./pages/LoginPage"
import { PricingPage } from "./pages/PricingPage"
import { ProjectsPage } from "./pages/ProjectsPage"

function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, userId } = useAuth()
  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Loading…
      </div>
    )
  }
  if (!userId) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/terms" element={<LegalPage doc="terms" />} />
          <Route path="/privacy" element={<LegalPage doc="privacy" />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <ProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/app/:projectId"
            element={
              <RequireAuth>
                <EditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
