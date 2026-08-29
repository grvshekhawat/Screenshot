"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/auth/AuthProvider"

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, userId } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (ready && !userId) router.replace("/login")
  }, [ready, userId, router])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Loading…
      </div>
    )
  }
  if (!userId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Redirecting…
      </div>
    )
  }
  return children
}
