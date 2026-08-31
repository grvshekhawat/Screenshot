"use client"

import Link from "next/link"
import { useAuth } from "@/auth/AuthProvider"

export const MARKETING_DISPLAY =
  '"Outfit", ui-sans-serif, system-ui, sans-serif' as const

export function MarketingHeader({
  active,
}: {
  active?: "templates" | "blog" | "pricing"
}) {
  const { userId, ready } = useAuth()
  const startHref = userId ? "/app" : "/login"
  const startLabel = !ready
    ? "Sign in"
    : userId
      ? "Open app"
      : "Start free"

  const link = (href: string, key: typeof active, label: string) => (
    <Link
      href={href}
      className={`hidden rounded-md px-3 py-2 transition sm:inline ${
        active === key
          ? "text-white"
          : "text-zinc-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  )

  return (
    <header className="relative z-20 border-b border-white/[0.06] bg-[#07070a]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-[-0.02em] text-white"
          style={{ fontFamily: MARKETING_DISPLAY }}
        >
          Screenshot Studio
        </Link>
        <nav className="flex items-center gap-1 text-[13px] sm:gap-2">
          {link("/templates", "templates", "Templates")}
          {link("/pricing", "pricing", "Pricing")}
          {link("/blog", "blog", "Blog")}
          <Link
            href={startHref}
            className="ml-1 rounded-md bg-[#e8ff47] px-3.5 py-2 text-[13px] font-semibold text-[#0a0a0c] transition hover:bg-[#f0ff7a]"
          >
            {startLabel}
          </Link>
        </nav>
      </div>
    </header>
  )
}
