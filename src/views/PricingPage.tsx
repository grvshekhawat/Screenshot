"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "../auth/AuthProvider"
import { SiteFooter } from "../components/SiteFooter"
import { openCustomerPortal, startCheckout } from "../billing/checkout"
import { formatSubscriptionEndDate } from "../types/cloud"

export function PricingPage() {
  const { userId, canExport, profile, refreshProfile, usingLocalBackend } =
    useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const periodEndLabel = formatSubscriptionEndDate(
    profile?.subscription_period_end,
  )
  const status = profile?.subscription_status ?? "none"
  const canceledWithAccess =
    status === "canceled" && canExport && Boolean(periodEndLabel)
  const canceledExpired =
    status === "canceled" && !canExport && Boolean(periodEndLabel)

  const subscribe = async () => {
    if (!userId) {
      router.push("/login")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await startCheckout("stripe", userId)
      await refreshProfile()
      if (result.url) {
        window.location.href = result.url
        return
      }
      router.push("/app")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed")
    } finally {
      setBusy(false)
    }
  }

  const manage = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await openCustomerPortal(profile?.billing_provider ?? null)
      if (result.url?.startsWith("http")) {
        window.location.href = result.url
      } else if (result.url) {
        router.push(result.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open portal")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-[#0c0c10] text-zinc-100">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <Link href="/" className="text-sm font-semibold">
          Screenshot Studio
        </Link>
        <Link href={userId ? "/app" : "/login"} className="text-sm text-zinc-400 hover:text-white">
          {userId ? "Projects" : "Sign in"}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-center text-3xl font-semibold">Simple pricing</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Free to create. Pro to export. Pay with Stripe.
        </p>
        {usingLocalBackend ? (
          <p className="mx-auto mt-4 max-w-lg rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
            Demo mode: checkout activates Pro instantly without real charges.
          </p>
        ) : null}
        {canceledWithAccess && periodEndLabel ? (
          <p className="mx-auto mt-4 max-w-lg rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100">
            Subscription canceled. Pro access continues through{" "}
            <span className="font-semibold">{periodEndLabel}</span>.
          </p>
        ) : null}
        {canceledExpired && periodEndLabel ? (
          <p className="mx-auto mt-4 max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-sm text-zinc-300">
            Pro ended on <span className="font-semibold">{periodEndLabel}</span>.
            Subscribe again to restore clean exports.
          </p>
        ) : null}
        {error ? <p className="mt-4 text-center text-sm text-red-400">{error}</p> : null}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-semibold">Free</h2>
            <p className="mt-2 text-3xl font-semibold">$0</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-400">
              <li>Up to 5 projects</li>
              <li>Full editor</li>
              <li>Templates & clipart library</li>
              <li>Watermarked PNG preview</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-violet-500/50 bg-zinc-950 p-6">
            <h2 className="text-lg font-semibold">Pro</h2>
            <p className="mt-2 text-3xl font-semibold">
              $1.99
              <span className="text-base font-normal text-zinc-400"> / month</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-400">
              <li>Everything in Free</li>
              <li>Clean PNG slide export</li>
              <li>ZIP for current store size</li>
              <li>ZIP for all sizes (iPhone, iPad, Play)</li>
            </ul>
            {canExport && status === "active" ? (
              <div className="mt-6 space-y-2">
                {periodEndLabel ? (
                  <p className="text-center text-xs text-orange-400">
                    Current period ends {periodEndLabel}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void manage()}
                  className="w-full rounded-lg border border-zinc-700 py-2.5 text-sm font-semibold hover:bg-zinc-900"
                >
                  Manage subscription
                </button>
              </div>
            ) : canExport && canceledWithAccess ? (
              <div className="mt-6 space-y-2">
                <p className="text-center text-xs text-amber-200/90">
                  Pro until {periodEndLabel}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void manage()}
                  className="w-full rounded-lg border border-zinc-700 py-2.5 text-sm font-semibold hover:bg-zinc-900"
                >
                  Manage billing
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void subscribe()}
                  className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  Resubscribe with Stripe
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void subscribe()}
                  className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  Subscribe with Stripe
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
