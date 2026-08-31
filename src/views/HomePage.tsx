"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  hydratePublishedTemplatePreviews,
  listPublishedTemplatesMeta,
} from "../api/projects"
import { useAuth } from "../auth/AuthProvider"
import {
  projectOrientation,
  type ArtboardOrientation,
} from "../orientation"
import type { TemplateRecord } from "../types/cloud"
import { CatalogThumbnail } from "../components/CatalogThumbnail"
import {
  MARKETING_DISPLAY,
  MarketingHeader,
} from "../components/MarketingHeader"
import { TemplateThumbnail } from "../components/TemplateThumbnail"
import { SiteFooter } from "../components/SiteFooter"
import { HOME_FAQS } from "../lib/home-faq"

function templatePreviewSrc(template: TemplateRecord): string | null {
  if (template.preview_url && !template.preview_url.startsWith("data:")) {
    return template.preview_url
  }
  if (template.preview_path?.startsWith("http")) return template.preview_path
  if (
    template.preview_url?.startsWith("data:") &&
    template.preview_url.length < 80_000
  ) {
    return template.preview_url
  }
  return null
}

const PROOF = [
  { value: "Thousands", label: "Store screenshots designed" },
  { value: "App Store", label: "iPhone & iPad sizes covered" },
  { value: "Google Play", label: "Phone sizes ready to export" },
] as const

const STEPS = [
  {
    n: "01",
    title: "Pick a template",
    body: "Start from a conversion-ready layout built for store listings—not a blank canvas.",
  },
  {
    n: "02",
    title: "Drop in your screens",
    body: "Frame devices, write headlines, add clipart and lenses. Edit everything on one artboard.",
  },
  {
    n: "03",
    title: "Export every size",
    body: "Download a clean PNG or a ZIP for every store size in your project’s orientation.",
  },
] as const

export function HomePage() {
  const { userId, ready } = useAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [orientation, setOrientation] =
    useState<ArtboardOrientation>("portrait")

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await listPublishedTemplatesMeta()
        if (cancelled) return
        setTemplates(rows)
        await hydratePublishedTemplatePreviews(rows, (updated) => {
          if (cancelled) return
          setTemplates((prev) =>
            prev.map((row) => (row.id === updated.id ? updated : row)),
          )
        })
      } catch {
        if (!cancelled) setTemplates([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready])

  const visibleTemplates = useMemo(
    () =>
      templates.filter(
        (template) => projectOrientation(template.data) === orientation,
      ),
    [templates, orientation],
  )

  const marqueeTemplates = useMemo(() => {
    const portrait = templates.filter(
      (template) => projectOrientation(template.data) === "portrait",
    )
    const pool = portrait.length > 0 ? portrait : templates
    return pool.slice(0, 8)
  }, [templates])

  const goToEditor = () => router.push(userId ? "/app" : "/login")
  const startHref = userId ? "/app" : "/login"

  return (
    <div className="flex min-h-full flex-col bg-[#07070a] text-zinc-100">
      <MarketingHeader />

      {/* Hero — one composition: brand, headline, support, CTAs, product plane */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          className="ss-glow-drift pointer-events-none absolute -left-1/4 top-[-20%] h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.14),transparent_65%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-1/4 bottom-[-30%] h-[60%] w-[60%] rounded-full bg-[radial-gradient(circle,rgba(232,255,71,0.08),transparent_60%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 20%, black, transparent)",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-20">
          <p
            className="ss-fade-up text-center text-[13px] font-medium tracking-[0.18em] text-[#e8ff47]/90 uppercase"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            Screenshot Studio
          </p>
          <h1
            className="ss-fade-up ss-fade-up-delay-1 mx-auto mt-4 max-w-3xl text-center text-[2.35rem] leading-[1.05] font-semibold tracking-[-0.04em] text-white sm:text-5xl md:text-[3.35rem]"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            App Store screenshots that look shipped—not drafted
          </h1>
          <p className="ss-fade-up ss-fade-up-delay-2 mx-auto mt-5 max-w-xl text-center text-[15px] leading-relaxed text-zinc-400 sm:text-base">
            Design once for iPhone, iPad, and Google Play. Templates, device
            frames, and multi-size exports—built for listings that convert.
          </p>
          <div className="ss-fade-up ss-fade-up-delay-3 mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={startHref}
              className="rounded-md bg-[#e8ff47] px-6 py-3 text-sm font-semibold text-[#0a0a0c] transition hover:bg-[#f0ff7a]"
            >
              Create your first set
            </Link>
            <Link
              href="/templates"
              className="rounded-md border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              Browse templates
            </Link>
          </div>
        </div>

        <div className="ss-fade-up ss-fade-up-delay-3 relative pb-12 sm:pb-16">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#07070a] to-transparent sm:w-28"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#07070a] to-transparent sm:w-28"
            aria-hidden
          />
          {marqueeTemplates.length > 0 ? (
            <div className="overflow-hidden">
              <div className="ss-marquee flex gap-4 px-4">
                {[...marqueeTemplates, ...marqueeTemplates].map(
                  (template, index) => (
                    <button
                      key={`${template.id}-${index}`}
                      type="button"
                      onClick={goToEditor}
                      aria-label={`Open template ${template.title}`}
                      className="group relative h-[220px] w-[min(72vw,520px)] shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-900/80 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.9)] sm:h-[260px] sm:w-[560px]"
                    >
                      <CatalogThumbnail
                        src={templatePreviewSrc(template)}
                        className="h-full w-full rounded-none"
                        variant="strip"
                        zoomOnHover
                      />
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-[220px] max-w-5xl items-center justify-center rounded-lg border border-dashed border-white/10 bg-zinc-900/40 sm:h-[260px]">
              <p className="text-sm text-zinc-500">Loading template previews…</p>
            </div>
          )}
        </div>
      </section>

      {/* Social proof — not in hero */}
      <section className="border-b border-white/[0.06] bg-[#0a0a0e]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {PROOF.map((item) => (
            <div key={item.label} className="px-6 py-8 text-center sm:py-10">
              <p
                className="text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                {item.value}
              </p>
              <p className="mt-1.5 text-[13px] text-zinc-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <h2
            className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            From raw screen to store listing in minutes
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
            The same workflow teams use for App Store and Play launches—without
            wrestling Figma artboards or export scripts.
          </p>
        </div>
        <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step) => (
            <li key={step.n}>
              <span
                className="text-[13px] font-medium tracking-[0.14em] text-[#e8ff47]/80 uppercase"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                {step.n}
              </span>
              <h3
                className="mt-3 text-lg font-semibold tracking-tight text-white"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                {step.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Templates */}
      <section className="border-t border-white/[0.06] bg-[#0a0a0e]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <h2
                className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                Templates built for real listings
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                Browse freely. Sign in when you’re ready to customize and
                export.{" "}
                <Link
                  href="/templates"
                  className="text-zinc-200 underline decoration-white/20 underline-offset-4 hover:decoration-white/50"
                >
                  See all templates
                </Link>
              </p>
            </div>
            <div
              className="flex rounded-md border border-white/10 p-0.5"
              role="group"
              aria-label="Orientation"
            >
              <button
                type="button"
                onClick={() => setOrientation("portrait")}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                  orientation === "portrait"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setOrientation("landscape")}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                  orientation === "landscape"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Landscape
              </button>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {visibleTemplates.map((template) => (
              <TemplateThumbnail
                key={template.id}
                template={template}
                className="w-full border border-white/[0.08]"
                onClick={goToEditor}
              />
            ))}
            {visibleTemplates.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No {orientation} templates published yet.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Guides — internal link to blog */}
      <section className="border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-14 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-16">
          <div className="max-w-xl">
            <h2
              className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl"
              style={{ fontFamily: MARKETING_DISPLAY }}
            >
              Store screenshot guides
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
              Size charts, iPhone class differences, and export tips—written for
              App Store and Play listings.
            </p>
          </div>
          <Link
            href="/blog"
            className="shrink-0 rounded-md border border-white/15 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.06]"
          >
            Read the blog
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/[0.06] bg-[#0a0a0e]">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <h2
            className="text-center text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            Frequently asked questions
          </h2>
          <dl className="mt-10 divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {HOME_FAQS.map((item) => (
              <div key={item.question} className="py-5">
                <dt
                  className="text-[15px] font-semibold tracking-tight text-zinc-100"
                  style={{ fontFamily: MARKETING_DISPLAY }}
                >
                  {item.question}
                </dt>
                <dd className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden border-t border-white/[0.06]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(232,255,71,0.07),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <h2
            className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl"
                style={{ fontFamily: MARKETING_DISPLAY }}
          >
            Ship your next listing today
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
            Free to create and save up to 5 projects. Pro unlocks clean PNG and
            multi-size ZIP exports—no watermark.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={startHref}
              className="rounded-md bg-[#e8ff47] px-6 py-3 text-sm font-semibold text-[#0a0a0c] transition hover:bg-[#f0ff7a]"
            >
              {userId ? "Open your projects" : "Start free—no card required"}
            </Link>
            <Link
              href="/pricing"
              className="rounded-md px-5 py-3 text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
