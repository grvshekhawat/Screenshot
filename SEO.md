# SEO playbook (low churn)

Improve search visibility mainly by **publishing content** and **tightening metadata**—not redesigning pages. SSR marketing, sitemap, robots, blog MDX, and template SEO pages already exist.

## Content cadence

### Blog (`content/blog/*.mdx`)

- **Cadence:** 1 post every 1–2 weeks.
- **Frontmatter (required):** `title`, `description`, `date` (YYYY-MM-DD), `slug` (stable forever).
- **Optional:** `image` (absolute or site path) for OG / BlogPosting.
- **Structure:** short intro → concrete sizes/steps → how Screenshot Studio helps → CTA to `/templates` or `/login`.
- New files are picked up automatically by [`src/app/sitemap.ts`](src/app/sitemap.ts) and `/blog/rss.xml`.

**Topic ideas (rotate):** App Store sizes updates · iPhone 6.9 vs 6.5 · Play feature graphic vs screenshots · screenshots without Figma · multi-size ZIP export · portrait vs landscape sets.

### Templates (Admin publish)

- Every published template is an indexable `/templates/[slug]` page.
- **Keep slugs stable** after first publish.
- Prefer descriptive titles/descriptions (“Portrait fitness App Store set”) over “Template 3”.

## Search Console ops

One-time (also mirrored in `GO_LIVE.md` §G):

1. Add property for production origin (e.g. `https://screenshot.design`).
2. Verify ownership (DNS TXT or HTML).
3. Submit sitemap: `{origin}/sitemap.xml`.
4. Spot-check `/`, `/pricing`, `/templates`, `/blog`, plus a few slugs.

**Per publish:** after deploy, use URL Inspection on new blog/template URLs if they don’t appear within a few days.

**Monthly:**

- Coverage / indexing issues → fix broken redirects or noindex mistakes (never index `/app`, `/login`, `/admin`).
- Top queries → rewrite 2–3 underperforming titles/descriptions in MDX frontmatter or template metadata only.
- Track 2–3 target queries manually until product analytics is added.

## Tech hygiene (already in product)

- Richer `BlogPosting` + `BreadcrumbList` on blog/template detail.
- Catalog image `alt` text; home → blog link; related posts on blog posts.
- `/blog/rss.xml`; FAQ section + `FAQPage` JSON-LD on the homepage.

## Do not chase

- Landing redesigns “for SEO”, keyword stuffing, changing template slugs, indexing app surfaces, hreflang until multi-locale is real.
