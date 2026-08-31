"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "../auth/AuthProvider"
import {
  MARKETING_DISPLAY,
  MarketingHeader,
} from "../components/MarketingHeader"
import { SiteFooter } from "../components/SiteFooter"
import { openCustomerPortal, startCheckout } from "../billing/checkout"
import { formatSubscriptionEndDate } from "../types/cloud"

const btnPrimary =
  "w-full rounded-md bg-[#e8ff47] py-2.5 text-sm font-semibold text-[#0a0a0c] transition hover:bg-[#f0ff7a] disabled:opacity-50"
const btnGhost =
  "w-full rounded-md border border-white/15 bg-white/[0.03] py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.06] disabled:opacity-50"

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
    <div className="flex min-h-full flex-col bg-[#07070a] text-zinc-100">
      <MarketingHeader active="pricing" />

      <main className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,255,71,0.07),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
          <h1
            className="text-center text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            Simple pricing
          </h1>
          <p className="mx-auto mt-3 max-w-md text-center text-[15px] text-zinc-400">
            Free to create. Pro to export. Pay with Stripe.
          </p>
          {usingLocalBackend ? (
            <p className="mx-auto mt-4 max-w-lg rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
              Demo mode: checkout activates Pro instantly without real charges.
            </p>
          ) : null}
          {canceledWithAccess && periodEndLabel ? (
            <p className="mx-auto mt-4 max-w-lg rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100">
              Subscription canceled. Pro access continues through{" "}
              <span className="font-semibold">{periodEndLabel}</span>.
            </p>
          ) : null}
          {canceledExpired && periodEndLabel ? (
            <p className="mx-auto mt-4 max-w-lg rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-sm text-zinc-300">
              Pro ended on <span className="font-semibold">{periodEndLabel}</span>.
              Subscribe again to restore clean exports.
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-center text-sm text-red-400">{error}</p>
          ) : null}

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-6">
              <h2
                className="text-lg font-semibold tracking-tight"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                Free
              </h2>
              <p
                className="mt-3 text-3xl font-semibold tracking-tight"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                $0
              </p>
              <ul className="mt-5 space-y-2.5 text-[14px] text-zinc-400">
                <li>Up to 5 projects</li>
                <li>Full editor</li>
                <li>Templates & clipart library</li>
                <li>Watermarked PNG preview</li>
              </ul>
            </div>
            <div className="relative rounded-lg border border-[#e8ff47]/35 bg-white/[0.03] p-6 shadow-[0_24px_60px_-40px_rgba(232,255,71,0.25)]">
              <p
                className="text-[11px] font-medium tracking-[0.14em] text-[#e8ff47]/90 uppercase"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                Recommended
              </p>
              <h2
                className="mt-2 text-lg font-semibold tracking-tight"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                Pro
              </h2>
              <p
                className="mt-3 text-3xl font-semibold tracking-tight"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                $1.99
                <span className="text-base font-normal text-zinc-400">
                  {" "}
                  / month
                </span>
              </p>
              <ul className="mt-5 space-y-2.5 text-[14px] text-zinc-400">
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
                    className={btnGhost}
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
                    className={btnGhost}
                  >
                    Manage billing
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void subscribe()}
                    className={btnPrimary}
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
                    className={btnPrimary}
                  >
                    Subscribe with Stripe
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
