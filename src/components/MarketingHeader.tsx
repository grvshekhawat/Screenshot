import Link from "next/link"

export function MarketingHeader({
  active,
}: {
  active?: "templates" | "blog" | "pricing"
}) {
  const link = (href: string, key: typeof active, label: string) => (
    <Link
      href={href}
      className={
        active === key ? "text-white" : "text-zinc-400 hover:text-white"
      }
    >
      {label}
    </Link>
  )

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
      <Link href="/" className="text-sm font-semibold text-zinc-100">
        Screenshot Studio
      </Link>
      <nav className="flex gap-3 text-sm">
        {link("/templates", "templates", "Templates")}
        {link("/blog", "blog", "Blog")}
        {link("/pricing", "pricing", "Pricing")}
        <Link
          href="/login"
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Sign in
        </Link>
      </nav>
    </header>
  )
}
