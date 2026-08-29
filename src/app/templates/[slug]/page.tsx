import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { MarketingHeader } from "@/components/MarketingHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { TemplatePreviewImage } from "@/components/TemplatePreviewImage"
import {
  getSeoTemplateBySlug,
  listSeoTemplates,
} from "@/lib/templates-seo"
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
      url: `${siteOrigin()}/templates/${slug}`,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: template.title,
    description: template.description,
    url: `${siteOrigin()}/templates/${template.slug}`,
    image: template.preview_url || undefined,
  }

  return (
    <div className="flex min-h-full flex-col bg-[#0c0c10] text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingHeader active="templates" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          <Link href="/templates" className="hover:text-zinc-300">
            Templates
          </Link>
          <span className="mx-2">/</span>
          {template.orientation}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {template.title}
        </h1>
        <p className="mt-4 text-base text-zinc-400">
          {template.description ||
            `A ${template.orientation} screenshot template for App Store and Google Play marketing creatives.`}
        </p>
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          <TemplatePreviewImage
            slug={template.slug}
            title={template.title}
            initialPreviewUrl={template.preview_url}
          />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Use this template
          </Link>
          <Link
            href="/templates"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            All templates
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
