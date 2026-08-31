import type { Metadata } from "next"
import Link from "next/link"
import {
  MARKETING_DISPLAY,
  MarketingHeader,
} from "@/components/MarketingHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { listBlogPosts } from "@/lib/blog"
import { siteOrigin } from "@/config"

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides on App Store screenshot sizes, Google Play graphics, and exporting store creatives with Screenshot Studio.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog · Screenshot Studio",
    description:
      "Guides on App Store screenshot sizes, Google Play graphics, and exporting store creatives.",
    url: `${siteOrigin()}/blog`,
  },
}

export default function BlogIndexPage() {
  const posts = listBlogPosts()

  return (
    <div className="flex min-h-full flex-col bg-[#07070a] text-zinc-100">
      <MarketingHeader active="blog" />
      <main className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(ellipse_at_40%_0%,rgba(56,189,248,0.08),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-16">
          <p
            className="text-[13px] font-medium tracking-[0.18em] text-[#e8ff47]/90 uppercase"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            Blog
          </p>
          <h1
            className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl"
            style={{ fontFamily: MARKETING_DISPLAY }}
          >
            Notes on store screenshots
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
            Practical guides on App Store sizes, Play graphics, and export
            workflows.
          </p>
          <ul className="mt-12 space-y-0 divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {posts.map((post) => (
              <li key={post.slug}>
                <article className="py-7">
                  <p className="text-[12px] text-zinc-500">
                    <time dateTime={post.date}>{post.date}</time>
                    <span className="mx-2 text-zinc-700">·</span>
                    {post.readingMinutes} min read
                  </p>
                  <h2
                    className="mt-2 text-xl font-semibold tracking-tight"
                    style={{ fontFamily: MARKETING_DISPLAY }}
                  >
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-zinc-100 transition hover:text-[#e8ff47]"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                    {post.description}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
