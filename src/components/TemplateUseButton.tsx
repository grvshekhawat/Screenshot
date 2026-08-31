"use client"

import Link from "next/link"
import { useAuth } from "@/auth/AuthProvider"

/** Auth-aware primary CTA for the public template detail page. */
export function TemplateUseButton() {
  const { userId, ready } = useAuth()
  const href = userId ? "/app" : "/login"
  const label = !ready
    ? "Use this template"
    : userId
      ? "Open in editor"
      : "Use this template"

  return (
    <Link
      href={href}
      className="rounded-md bg-[#e8ff47] px-5 py-2.5 text-sm font-semibold text-[#0a0a0c] transition hover:bg-[#f0ff7a]"
    >
      {label}
    </Link>
  )
}
