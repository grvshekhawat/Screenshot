import type { Metadata } from "next"
import Link from "next/link"
import { MarketingHeader } from "@/components/MarketingHeader"
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
    <div className="flex min-h-full flex-col bg-[#0c0c10] text-zinc-100">
      <MarketingHeader active="blog" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Practical notes on store screenshot sizes and export workflows.
        </p>
        <ul className="mt-10 space-y-8">
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <p className="text-xs text-zinc-500">
                  <time dateTime={post.date}>{post.date}</time>
                  <span className="mx-2">·</span>
                  {post.readingMinutes} min read
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-violet-300"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-zinc-400">{post.description}</p>
              </article>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  )
}
