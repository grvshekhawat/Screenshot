import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  MARKETING_DISPLAY,
  MarketingHeader,
} from "@/components/MarketingHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { TemplatePreviewImage } from "@/components/TemplatePreviewImage"
import { TemplateUseButton } from "@/components/TemplateUseButton"
import {
  getSeoTemplateBySlug,
  listSeoTemplates,
} from "@/lib/templates-seo"
import { breadcrumbJsonLd } from "@/lib/seo-schema"
import { siteOrigin } from "@/config"

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const templates = await listSeoTemplates()
  return templates.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const template = await getSeoTemplateBySlug(slug)
  if (!template) return { title: "Template not found" }
  const title = template.title
  const description =
    template.description ||
    `${template.orientation} App Store / Play screenshot template — use it free in Screenshot Studio.`
  return {
    title,
    description,
    alternates: { canonical: `/templates/${slug}` },
    openGraph: {
      title: `${title} · Screenshot Studio`,
      description,
      url: `${siteOrigin()}/templates/${template.slug}`,
      images: template.preview_url
        ? [{ url: template.preview_url }]
        : [{ url: "/og.png" }],
    },
  }
}

export default async function TemplateDetailPage({ params }: Props) {
  const { slug } = await params
  const template = await getSeoTemplateBySlug(slug)
  if (!template) notFound()

  const origin = siteOrigin()
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: template.title,
    description: template.description,
    url: `${origin}/templates/${template.slug}`,
    image: template.preview_url || undefined,
  }
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Templates", path: "/templates" },
    { name: template.title, path: `/templates/${template.slug}` },
  ])

  return (
    <div className="flex min-h-full flex-col bg-[#07070a] text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <MarketingHeader active="templates" />
      <main className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(56,189,248,0.09),transparent_60%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-32 h-[280px] w-[40%] bg-[radial-gradient(circle,rgba(232,255,71,0.07),transparent_65%)]"
          aria-hidden
        />

        <div className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
          <p className="text-[12px] tracking-wide text-zinc-500">
            <Link
              href="/templates"
              className="transition hover:text-zinc-300"
            >
              Templates
            </Link>
            <span className="mx-2 text-zinc-700">/</span>
            <span className="tracking-[0.12em] text-zinc-400 uppercase">
              {template.orientation}
            </span>
          </p>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1
                className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.1]"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                {template.title}
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-400">
                {template.description ||
                  `A ${template.orientation} screenshot template for App Store and Google Play marketing creatives.`}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <TemplateUseButton />
              <Link
                href="/templates"
                className="rounded-md border border-white/15 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.06]"
              >
                All templates
              </Link>
            </div>
          </div>

          <div className="relative mt-10 overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-950 shadow-[0_32px_90px_-48px_rgba(0,0,0,0.95)]">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_50%)]"
              aria-hidden
            />
            <TemplatePreviewImage
              slug={template.slug}
              title={template.title}
              initialPreviewUrl={template.preview_url}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
