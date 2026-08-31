"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "../auth/AuthProvider"
import {
  MARKETING_DISPLAY,
  MarketingHeader,
} from "../components/MarketingHeader"
import { SiteFooter } from "../components/SiteFooter"

export function LoginPage() {
  const {
    userId,
    ready,
    signInWithPassword,
    signUpWithPassword,
    usingLocalBackend,
  } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)

  useEffect(() => {
    if (ready && userId) router.replace("/app")
  }, [ready, userId, router])

  if (ready && userId) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#07070a] text-sm text-zinc-400">
        Redirecting…
      </div>
    )
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === "signup") {
        if (!acceptedLegal) {
          setError("Please accept the Terms and Privacy Policy to continue.")
          return
        }
        const result = await signUpWithPassword(email, password)
        if (result === "confirm-email") {
          setMessage(
            "Check your email to confirm the account, then sign in. Or turn off Confirm email in Supabase Auth to skip this.",
          )
          return
        }
      } else {
        await signInWithPassword(email, password)
      }
      router.push("/app")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  const fieldClass =
    "w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#e8ff47]/50"

  return (
    <div className="flex min-h-full flex-col bg-[#07070a]">
      <MarketingHeader />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(56,189,248,0.08),transparent_55%)]"
          aria-hidden
        />
        <div className="relative w-full max-w-sm">
          <h1
            className="text-center text-2xl font-semibold tracking-[-0.03em] text-white"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            {mode === "signup" ? "Create account" : "Sign in"}
          </h1>
          <p className="mt-2 text-center text-[14px] text-zinc-400">
            Login is required to create and save projects.
          </p>

          <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.02] p-6">
            {usingLocalBackend ? (
              <p className="mb-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Local demo mode. Any email works; password is ignored. Admin:{" "}
                <code>you@admin.local</code>
              </p>
            ) : null}
            <div className="flex rounded-md border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setMode("signin")
                  setMessage(null)
                  setError(null)
                  setAcceptedLegal(false)
                }}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${
                  mode === "signin"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup")
                  setMessage(null)
                  setError(null)
                  setAcceptedLegal(false)
                }}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${
                  mode === "signup"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Sign up
              </button>
            </div>
            <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className={fieldClass}
              />
              <input
                type="password"
                required={!usingLocalBackend}
                minLength={usingLocalBackend ? undefined : 6}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className={fieldClass}
              />
              {mode === "signup" ? (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left text-[11px] leading-relaxed text-zinc-400">
                  <input
                    type="checkbox"
                    required
                    checked={acceptedLegal}
                    onChange={(event) => setAcceptedLegal(event.target.checked)}
                    className="mt-0.5 size-3.5 shrink-0 rounded border-zinc-600 bg-[#07070a] text-[#e8ff47] focus:ring-[#e8ff47]/40"
                  />
                  <span>
                    I agree to the{" "}
                    <Link
                      href="/terms"
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-200 underline-offset-2 hover:text-white hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy"
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-200 underline-offset-2 hover:text-white hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
              ) : null}
              <button
                type="submit"
                disabled={busy || (mode === "signup" && !acceptedLegal)}
                className="w-full rounded-md bg-[#e8ff47] py-2.5 text-sm font-semibold text-[#0a0a0c] transition hover:bg-[#f0ff7a] disabled:opacity-50"
              >
                {mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>
            {message ? (
              <p className="mt-3 text-sm text-emerald-400">{message}</p>
            ) : null}
            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500">
            <Link
              href="/templates"
              className="text-zinc-400 underline decoration-white/15 underline-offset-4 transition hover:text-zinc-200 hover:decoration-white/40"
            >
              Continue browsing templates
            </Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
