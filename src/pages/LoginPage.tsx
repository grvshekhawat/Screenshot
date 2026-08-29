import { useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "../auth/AuthProvider"

export function LoginPage() {
  const { userId, ready, signInWithEmail, usingLocalBackend } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
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
      await signInWithEmail(email)
      if (usingLocalBackend) {
        navigate("/app")
      } else {
        setMessage("Check your email for a magic link.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-[#0c0c10]">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <Link to="/" className="text-sm font-semibold text-white">
          Screenshot Studio
        </Link>
        <Link
          to="/"
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← Back to home
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-xl font-semibold text-white">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Login is required to create and save projects.
        </p>
        {usingLocalBackend ? (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Local demo mode (no Supabase env). Use any email. Admin:{" "}
            <code>you@admin.local</code>
          </p>
        ) : null}
        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {usingLocalBackend ? "Continue" : "Email magic link"}
          </button>
        </form>
        {message ? <p className="mt-3 text-sm text-emerald-400">{message}</p> : null}
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
