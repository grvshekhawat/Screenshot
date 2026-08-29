import type { Metadata } from "next"
import { MarketingHeader } from "@/components/MarketingHeader"
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
    <div className="flex min-h-full flex-col bg-[#0c0c10] text-zinc-100">
      <MarketingHeader active="templates" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Screenshot templates
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          Ready-made App Store and Google Play layouts. Open any template to use
          it in the editor after you sign in.
        </p>
        <TemplateCatalogGrid initial={templates} />
        {templates.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500">
            No published templates yet. Check back soon.
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  )
}
