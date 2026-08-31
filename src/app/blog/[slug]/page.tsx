import type { Metadata } from "next"
import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  OlHTMLAttributes,
  TableHTMLAttributes,
} from "react"
import { MDXRemote } from "next-mdx-remote/rsc"
import Link from "next/link"
import { notFound } from "next/navigation"
import { MarketingHeader } from "@/components/MarketingHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { getBlogPost, getRelatedBlogPosts, listBlogPosts } from "@/lib/blog"
import { breadcrumbJsonLd, publisherJsonLd } from "@/lib/seo-schema"
import { siteOrigin } from "@/config"

type Props = { params: Promise<{ slug: string }> }

const mdxComponents = {
  a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const href = props.href ?? ""
    if (href.startsWith("/")) {
      return (
        <Link
          href={href}
          className="text-[#e8ff47]/85 underline-offset-2 hover:underline"
        >
          {props.children}
        </Link>
      )
    }
    return (
      <a
        {...props}
        className="text-[#e8ff47]/85 underline-offset-2 hover:underline"
        rel="noreferrer"
      />
    )
  },
  h2: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="mt-10 text-xl font-semibold tracking-tight text-zinc-100"
      style={{ fontFamily: '"Outfit", ui-sans-serif, system-ui, sans-serif' }}
      {...props}
    />
  ),
  h3: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className="mt-8 text-lg font-semibold tracking-tight text-zinc-100"
      style={{ fontFamily: '"Outfit", ui-sans-serif, system-ui, sans-serif' }}
      {...props}
    />
  ),
  p: (props: HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mt-4 text-[15px] leading-relaxed text-zinc-400" {...props} />
  ),
  ul: (props: HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="mt-4 list-disc space-y-2 pl-5 text-[15px] text-zinc-400"
      {...props}
    />
  ),
  ol: (props: OlHTMLAttributes<HTMLOListElement>) => (
    <ol
      className="mt-4 list-decimal space-y-2 pl-5 text-[15px] text-zinc-400"
      {...props}
    />
  ),
  li: (props: HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed" {...props} />
  ),
  table: (props: TableHTMLAttributes<HTMLTableElement>) => (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-left text-sm text-zinc-400" {...props} />
    </div>
  ),
  th: (props: HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="border-b border-white/15 px-3 py-2 font-semibold text-zinc-200"
      {...props}
    />
  ),
  td: (props: HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-white/[0.06] px-3 py-2" {...props} />
  ),
  strong: (props: HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-zinc-200" {...props} />
  ),
}

export function generateStaticParams() {
  return listBlogPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return { title: "Post not found" }
  const origin = siteOrigin()
  const image = post.image || `${origin}/og.png`
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${origin}/blog/${slug}`,
      publishedTime: post.date,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [image],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const origin = siteOrigin()
  const imageUrl = post.image
    ? post.image.startsWith("http")
      ? post.image
      : `${origin}${post.image}`
    : `${origin}/og.png`
  const related = getRelatedBlogPosts(post.slug, 3)

  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    url: `${origin}/blog/${post.slug}`,
    mainEntityOfPage: `${origin}/blog/${post.slug}`,
    image: [imageUrl],
    author: {
      "@type": "Organization",
      name: "Screenshot Studio",
      url: origin,
    },
    publisher: publisherJsonLd(),
  }

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ])

  return (
    <div className="flex min-h-full flex-col bg-[#07070a] text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPosting) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <MarketingHeader active="blog" />
      <article className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-14">
        <p className="text-[12px] text-zinc-500">
          <Link href="/blog" className="transition hover:text-zinc-300">
            Blog
          </Link>
          <span className="mx-2 text-zinc-700">·</span>
          <time dateTime={post.date}>{post.date}</time>
          <span className="mx-2 text-zinc-700">·</span>
          {post.readingMinutes} min read
        </p>
        <h1
          className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl sm:leading-[1.15]"
          style={{
            fontFamily: '"Outfit", ui-sans-serif, system-ui, sans-serif',
          }}
        >
          {post.title}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
          {post.description}
        </p>
        <div className="mt-8 border-t border-white/[0.06] pt-2">
          <MDXRemote source={post.content} components={mdxComponents} />
        </div>

        {related.length > 0 ? (
          <aside className="mt-14 border-t border-white/[0.06] pt-10">
            <h2
              className="text-lg font-semibold tracking-tight text-white"
              style={{
                fontFamily: '"Outfit", ui-sans-serif, system-ui, sans-serif',
              }}
            >
              Related guides
            </h2>
            <ul className="mt-4 space-y-4">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/blog/${item.slug}`}
                    className="text-[15px] font-medium text-zinc-200 transition hover:text-[#e8ff47]"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 text-[13px] text-zinc-500">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </article>
      <SiteFooter />
    </div>
  )
}
