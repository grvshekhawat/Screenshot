import { useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "../auth/AuthProvider"

export function LoginPage() {
  const {
    userId,
    ready,
    signInWithPassword,
    signUpWithPassword,
    usingLocalBackend,
  } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (ready && userId) return <Navigate to="/app" replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === "signup") {
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
      navigate("/app")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"

  return (
    <div className="flex min-h-full flex-col bg-[#0c0c10]">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <Link to="/" className="text-sm font-semibold text-white">
          Screenshot Studio
        </Link>
        <Link to="/" className="text-sm text-zinc-400 hover:text-white">
          ← Back to home
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h1 className="text-xl font-semibold text-white">
            {mode === "signup" ? "Create account" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Login is required to create and save projects.
          </p>
          {usingLocalBackend ? (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Local demo mode. Any email works; password is ignored. Admin:{" "}
              <code>you@admin.local</code>
            </p>
          ) : null}
          <div className="mt-4 flex rounded-lg bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("signin")
                setMessage(null)
                setError(null)
              }}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium ${
                mode === "signin"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
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
              }}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium ${
                mode === "signup"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
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
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
          {message ? (
            <p className="mt-3 text-sm text-emerald-400">{message}</p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          <p className="mt-4 text-center text-sm text-zinc-500">
            <Link to="/" className="text-zinc-300 hover:text-white">
              Continue browsing templates
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
