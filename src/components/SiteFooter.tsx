import Link from "next/link"

export const SUPPORT_EMAIL = "support@screenshot.design"

/** Shared footer for marketing / auth pages. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-800/80 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-zinc-500 sm:flex-row">
        <p>© {new Date().getFullYear()} Screenshot Studio</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/templates" className="hover:text-zinc-300">
            Templates
          </Link>
          <Link href="/blog" className="hover:text-zinc-300">
            Blog
          </Link>
          <Link href="/pricing" className="hover:text-zinc-300">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-zinc-300">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-zinc-300">
            Privacy
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-zinc-300">
            Support
          </a>
        </nav>
      </div>
    </footer>
  )
}
