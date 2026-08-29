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
import { getBlogPost, listBlogPosts } from "@/lib/blog"
import { siteOrigin } from "@/config"

type Props = { params: Promise<{ slug: string }> }

const mdxComponents = {
  a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const href = props.href ?? ""
    if (href.startsWith("/")) {
      return (
        <Link
          href={href}
          className="text-violet-300 underline-offset-2 hover:underline"
        >
          {props.children}
        </Link>
      )
    }
    return (
      <a
        {...props}
        className="text-violet-300 underline-offset-2 hover:underline"
        rel="noreferrer"
      />
    )
  },
  h2: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-10 text-xl font-semibold text-zinc-100" {...props} />
  ),
  h3: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-8 text-lg font-semibold text-zinc-100" {...props} />
  ),
  p: (props: HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mt-4 text-sm leading-relaxed text-zinc-400" {...props} />
  ),
  ul: (props: HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="mt-4 list-disc space-y-2 pl-5 text-sm text-zinc-400"
      {...props}
    />
  ),
  ol: (props: OlHTMLAttributes<HTMLOListElement>) => (
    <ol
      className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-400"
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
      className="border-b border-zinc-700 px-3 py-2 font-semibold text-zinc-200"
      {...props}
    />
  ),
  td: (props: HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-zinc-800 px-3 py-2" {...props} />
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
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${siteOrigin()}/blog/${slug}`,
      publishedTime: post.date,
      images: post.image ? [{ url: post.image }] : [{ url: "/og.png" }],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    url: `${siteOrigin()}/blog/${post.slug}`,
  }

  return (
    <div className="flex min-h-full flex-col bg-[#0c0c10] text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingHeader active="blog" />
      <article className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <p className="text-xs text-zinc-500">
          <Link href="/blog" className="hover:text-zinc-300">
            Blog
          </Link>
          <span className="mx-2">·</span>
          <time dateTime={post.date}>{post.date}</time>
          <span className="mx-2">·</span>
          {post.readingMinutes} min read
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-4 text-base text-zinc-400">{post.description}</p>
        <div className="mt-8 border-t border-zinc-800 pt-2">
          <MDXRemote source={post.content} components={mdxComponents} />
        </div>
      </article>
      <SiteFooter />
    </div>
  )
}
