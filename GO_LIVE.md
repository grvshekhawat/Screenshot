# Go-live checklist — Screenshot Studio

Ship order: **Supabase → billing → front-end → verify → announce**.

## A. Supabase project

- [x] Create production Supabase project (region close to users)
- [x] Run migrations **in order**:
  - [ ] `supabase/migrations/001_init.sql`
  - [ ] `supabase/migrations/002_public_catalog.sql`
  - [ ] `supabase/migrations/003_admin_catalog.sql`
- [x] Auth → Providers → **Email** enabled
- [x] Auth → turn **off Confirm email** (or configure custom SMTP if you want confirmation)
- [x] Create Storage buckets:
  - [x] `project-assets` (private)
  - [x] `templates`
  - [x] `cliparts`
- [x] Confirm Storage policies match migrations / dashboard setup notes in `001_init.sql`
- [x] Bucket CORS allows the production origin (needed for thumbnail / export image capture)
- [x] Set your user `profiles.role = 'admin'` after first sign-up



## B. Billing (Stripe ± PayPal)

- [ ] Stripe live mode: product + monthly price
- [x] Note live `price_…` id for env / secrets
- [x] Deploy Edge Functions:
  - [x] `stripe-checkout`
  - [x] `stripe-portal`
  - [x] `stripe-webhook`
  - [ ] `generate-clipart` (admin AI stickers — OpenAI)
  - [ ] `import-store-app` (admin store listing scrape)
  - [ ] `analyze-store-layout` (admin AI layout → components; needs OpenAI)
  - [ ] `paypal-subscribe` (optional)
  - [ ] `paypal-manage` (optional)
  - [ ] `paypal-webhook` (optional)
- [ ] Function secrets set:
  - [x] `STRIPE_SECRET_KEY`
  - [x] `STRIPE_PRICE_ID`
  - [x] `STRIPE_WEBHOOK_SECRET`
  - [x] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `OPENAI_API_KEY` (for `generate-clipart` + `analyze-store-layout`)
  - [ ] PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_PLAN_ID`, `PAYPAL_API_BASE` (live)
- [ ] Stripe webhook endpoint → `https://<project>.supabase.co/functions/v1/stripe-webhook` (events for Checkout + subscription lifecycle)
- [ ] Billing Portal enabled in Stripe (for cancel / manage)

### Free-month promo (Stripe coupon)

Checkout accepts promotion codes (`allow_promotion_codes` on `stripe-checkout`). To give **20 users one free month**:

1. Stripe → **Products → Coupons** → **Create coupon**
   - Percent off: **100%**
   - Duration: **Once** (first invoice only) — or **Repeating** for **1 month** if you prefer
2. **Promotion codes** → create a code (e.g. `LAUNCH20`) linked to that coupon
   - **Limit total redemptions** → **20**
   - Optional: set an expiry date
3. Redeploy checkout after code changes: `supabase functions deploy stripe-checkout`
4. Share the code; users subscribe from **Pricing** → enter code on the Stripe Checkout page

After the free period, Stripe bills the normal price unless they cancel in the billing portal. Webhook treats `trialing` and `active` as Pro.

### Admin AI clipart (`generate-clipart`)

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy generate-clipart
```

- Admin-only (`profiles.role = admin`). Prompt → transparent PNG preview on `/admin` → Publish uses existing `library_cliparts` / `cliparts` bucket.
- Model: OpenAI `gpt-image-1.5`, medium quality, ~$0.03–0.05 per generation. Not available in local demo mode.

### Admin store import (`import-store-app` + `analyze-store-layout`)

```bash
supabase secrets set OPENAI_API_KEY=sk-...   # shared with generate-clipart
supabase functions deploy import-store-app
supabase functions deploy analyze-store-layout
```

- Admin-only. Paste App Store / Play Store URL (or Apple app name) on `/admin` → scrape + upload + **in-memory vision analysis** (no Storage download for AI) → client rebuilds slides (one fetch per source for crops) → **Open in editor** or **Publish** (one fetch per asset for copy+preview).
- Apple: iTunes Lookup + App Store HTML fallback. Play: details page scrape (Play **name search not supported** — use a `play.google.com/...details?id=` URL). Cap 6 screens. Play CDN `=wN-hM` params are layout sizes — importer requests `=w1080-rw` and filters by **decoded** WebP/JPEG dimensions (rejects icons).
- Vision model: `gpt-4o` (~$0.01–0.05 per screen). Analysis failures fall back to a simple centered phone. Standalone `analyze-store-layout` kept only as fallback (does download — prefer import path).
- Store HTML can change; treat scrape failures as scraper breakage. Admin tool only — respect store ToS.



## C. Front-end deploy

- [x] Host on Vercel as **Next.js** (Framework Preset: Next.js). Do **not** use an SPA catch-all rewrite to `index.html`.
- [ ] In Vercel → Project Settings → General / Build & Development: **Framework Preset = Next.js**, clear **Output Directory** (must not be `dist` — that was Vite). `vercel.json` sets `"framework": "nextjs"`.
- [x] Custom domain (e.g. `screenshot.design`) + HTTPS
- [ ] Production env vars (from `.env.example` — **`NEXT_PUBLIC_*`**):
  - [ ] `NEXT_PUBLIC_APP_URL=https://<your-domain>`
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
  - [ ] `NEXT_PUBLIC_BILLING_FUNCTIONS_URL=https://<project>.supabase.co/functions/v1`
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `NEXT_PUBLIC_STRIPE_PRICE_ID`
  - [ ] PayPal public ids if enabled
- [ ] `npm run build` succeeds in CI / host
- [ ] Confirm app is **not** in local-demo mode (Supabase URL + key both set)
- [ ] Confirm public HTML: View Source on `/`, `/templates`, `/blog` shows real titles/body (not an empty root shell)



## D. Catalog / content

- [ ] Sign in as admin → `/admin`
- [ ] Publish at least a few templates (portrait + landscape); keep **slugs stable** after publish
- [ ] Publish clipart / shapes (and gestures if used)
- [ ] Logged-out Home and `/templates` show templates with strip thumbnails
- [ ] `/templates/[slug]` shows title, description, preview, CTA
- [ ] Delete/hide a seed template once to confirm `catalog_hidden_templates` works
- [ ] Blog posts under `content/blog/` render at `/blog` and `/blog/[slug]`
- [ ] Admin: Generate sticker (AI) → preview → Publish appears in editor clipart library
- [ ] Admin: Import from store (App Store / Play URL) → project opens → Publish to catalog



## E. Acceptance tests (production)



### Auth & projects

- [ ] Sign up + sign in (email + password)
- [ ] Create project (portrait) and (landscape)
- [ ] Autosave works; leave via ← Projects → list thumbnail matches last draft
- [ ] Non-admin hits **5 project** cap; admin does not
- [ ] Reload editor restores assets / clipart / screenshots



### Editor & export

- [ ] Upload screenshot (incl. WebP/JPEG); HEIC path OK or clear error
- [ ] Add library clipart → visible on canvas **and** after save on project thumbnail
- [ ] Lens on top of phone → phone still draggable
- [ ] Free user: watermarked PNG only
- [ ] Subscribe (Stripe test/live) → `profiles.subscription_status` active → clean PNG / ZIP
- [ ] Billing portal / cancel path updates status



### Public & admin

- [ ] Logged-out can browse templates; cannot create projects
- [ ] Login required to edit
- [ ] Admin publish template / clipart / delete template
- [ ] `/sitemap.xml` and `/robots.txt` reachable; robots disallow `/app`, `/admin`, `/login`



## F. Soft launch

- [x] Privacy Policy + Terms linked from pricing / footer / signup (`/privacy`, `/terms`)
- [x] Support contact (email or form) — `support@screenshot.design`
- [ ] Stripe / Supabase billing alerts on
- [ ] Smoke on mobile Safari + desktop Chrome
- [ ] Error / uptime glance (Supabase logs, host analytics)
- [ ] Remove or gate any demo-only Pro shortcuts if still present in UI



## G. SEO / Search Console

See **`SEO.md`** for the ongoing content cadence and monthly review loop.

### One-time setup

- [ ] Google Search Console → add property for `https://screenshot.design`
- [ ] Verify ownership (DNS TXT or HTML meta / file)
- [ ] Submit sitemap: `https://screenshot.design/sitemap.xml`
- [ ] Spot-check indexed URLs for `/`, `/pricing`, `/templates`, `/blog`, and a few template/blog slugs
- [ ] Confirm `/blog/rss.xml` loads

### Monthly (ops)

- [ ] Coverage / indexing: fix errors; keep `/app`, `/admin`, `/login` noindexed
- [ ] Queries + CTR: rewrite 2–3 weak titles/descriptions (MDX frontmatter or template metadata only)
- [ ] Note 2–3 target queries (e.g. App Store screenshot sizes) and whether impressions are rising
- [ ] After new posts/templates: URL Inspection if not indexed within a few days

### Content cadence (no redesign)

- [ ] 1 blog MDX every 1–2 weeks under `content/blog/` (`title`, `description`, `date`, stable `slug`)
- [ ] Publish templates with descriptive titles; **never change slug** after publish



## H. Launch

- [ ] Final deploy from main
- [ ] DNS live; `NEXT_PUBLIC_APP_URL` matches canonical URL
- [ ] One full path as a stranger: land → template → signup → edit → export → pay
- [ ] Announce

---

**Rollback:** keep previous Vercel deployment; Supabase migrations are additive — do not drop prod data without a backup.