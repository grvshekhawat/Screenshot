import type { Metadata } from "next"
import {
  MARKETING_DISPLAY,
  MarketingHeader,
} from "@/components/MarketingHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { TemplateCatalogGrid } from "@/components/TemplateCatalogGrid"
import { listSeoTemplates } from "@/lib/templates-seo"
import { siteOrigin } from "@/config"

export const metadata: Metadata = {
  title: "App Store & Play screenshot templates",
  description:
    "Browse free App Store and Google Play screenshot templates for iPhone, iPad, and Android. Use any template in Screenshot Studio.",
  alternates: { canonical: "/templates" },
  openGraph: {
    title: "Screenshot templates · Screenshot Studio",
    description:
      "Browse free App Store and Google Play screenshot templates for iPhone, iPad, and Android.",
    url: `${siteOrigin()}/templates`,
  },
}

export const revalidate = 3600

export default async function TemplatesIndexPage() {
  const templates = await listSeoTemplates()

  return (
    <div className="flex min-h-full flex-col bg-[#07070a] text-zinc-100">
      <MarketingHeader active="templates" />
      <main className="relative flex-1 overflow-hidden">
        <div
          className="ss-glow-drift pointer-events-none absolute -left-1/4 top-0 h-[50%] w-[55%] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.1),transparent_65%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-1/5 top-24 h-[40%] w-[45%] rounded-full bg-[radial-gradient(circle,rgba(232,255,71,0.06),transparent_60%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse 75% 55% at 50% 0%, black, transparent)",
          }}
          aria-hidden
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-16">
          <p
            className="ss-fade-up text-[13px] font-medium tracking-[0.18em] text-[#e8ff47]/90 uppercase"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            Template gallery
          </p>
          <h1
            className="ss-fade-up ss-fade-up-delay-1 mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            Layouts ready for your next listing
          </h1>
          <p className="ss-fade-up ss-fade-up-delay-2 mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Pick a portrait or landscape set, swap in your screens, and export
            every store size. Sign in when you’re ready to customize.
          </p>

          <TemplateCatalogGrid initial={templates} />

          {templates.length === 0 ? (
            <p className="mt-8 text-sm text-zinc-500">
              No published templates yet. Check back soon.
            </p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
