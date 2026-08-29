# Screenshot Studio

Cloud SaaS App Store / Play screenshot editor (**Next.js App Router** + React). Auth, projects, templates, and clipart catalog use Supabase when configured; otherwise a **local demo backend** (`src/api/local-backend.ts`) keeps the app runnable without env keys.

## Product rules

| Action | Requirement |
|--------|-------------|
| Browse templates / clipart library | Public (thumbnails only; no project created) |
| Create / save / edit projects | Login |
| Max projects per account | **5** (admins: no cap) |
| PNG preview export | Free (watermarked) |
| Clean PNG / ZIP / all-sizes ZIP | Active monthly subscription (**admins: always**) |
| Pay | Stripe (card) — $1.99/mo (PayPal UI hidden for now) |

## Architecture

- Framework: Next.js App Router (`src/app/`); shared UI/logic under `src/` (page components in `src/views/`). Public marketing/blog/template pages are server-rendered HTML for SEO; `/app` and `/admin` are client-heavy.
- Auth: `src/auth/AuthProvider.tsx` — email + password (Supabase) or email demo (local). Magic links are not used.
- Projects: `src/api/projects.ts` — cloud CRUD + 5-cap for non-admins (`enforce_project_limit`; admins skip); editor at `/app/[projectId]`. Local demo backend stores projects/assets in **IndexedDB** (migrates off `localStorage` to avoid ~5MB quota errors)
- State: `src/project-store.tsx` — cloud autosave when `projectId` set; IndexedDB fallback when not. **Editor hydrate** resolves only the active size’s assets before `ready`, then loads other `sizeLayouts` + clipart library in the background (batched signed URLs). Skips the autosave that would fire on hydrate alone.
- Billing: `src/billing/*` + Edge Functions under `supabase/functions/` (Stripe + PayPal webhooks → `profiles`)
- Catalog: published `templates` + `library_cliparts`; admin at `/admin` with **Templates** / **Clipart** tabs (`*@admin.local` in demo, or `profiles.role = admin`). Logged-out visitors can read published templates (RLS + `GRANT SELECT` to `anon`). Landing page merges built-in seeds with cloud rows; deleted seeds stay gone via `catalog_hidden_templates` (run `003_admin_catalog.sql`). Admins can DELETE templates (RLS + grants).
  - **Admin AI stickers:** `/admin` → Clipart tab → Generate → Edge Function `generate-clipart` (OpenAI `gpt-image-1.5`, transparent PNG cutout without white sticker rim, ~$0.03–0.05 medium) → preview → Publish via `upsertLibraryClipart`. Requires `OPENAI_API_KEY` secret; admin role checked in the function. Not available in local demo mode.
  - **Admin store import:** `/admin` → Import from store → `import-store-app` scrapes listing screenshots (Play: `=w1080-rw` + decode WebP dims; reject icons) → `analyze-store-layout` (vision) returns deviceBox/screenBox/texts/clipart boxes → `buildProjectFromStoreAnalysis` crops UI + decor, places phones from boxes, Montserrat-style headlines, blurred photo backgrounds → **Open in editor** or **Publish**. Requires `OPENAI_API_KEY`. Cap 6 screens.
  - Public SEO catalog: `/templates` and `/templates/[slug]` use `src/lib/templates-seo.ts` (server-safe titles/descriptions; preview `<img>` when stored). Client hydrates missing seed previews via `listPublishedTemplates` (same canvas path as Home).
  - Templates: design in the editor → Admin → pick project → **Publish as template** (copies assets into `templates/` bucket; writes multi-slide `preview_path` strip image). Keep **slugs stable** after publish for SEO.
  - **List thumbnails are cache-first:** Home / Projects / Admin load only the stored strip image (`thumbnail_path` / `preview_path` → signed URL). They do **not** remount artboards per visit. Strip is regenerated on project create/save and template publish (and once if the cache is missing). Built-in seed previews cache in IndexedDB keyed by seed id + catalog seed version. Preview assets are inlined as data URLs; recolored clipart is canvas-baked to `<img>` so strips include clipart (CSS `mask-image` is not capture-safe).
- Project list cards use `thumbnail_path` / `thumbnail_url` (same strip as templates), refreshed on save and when leaving the editor (`flushSave` on ← Projects / unmount). List URLs append `updated_at` as a cache-buster so the new strip shows after exit.
  - Local demo seeds 4 portrait + 4 landscape gallery templates (`sample-screens.ts` / `sample-templates.ts`, catalog seed v10). Landscape phones reuse portrait chrome rotated −90°; screenshots stay upright (counter-rotated).
- Blog: MDX under `content/blog/` → `/blog`, `/blog/[slug]`
- Crawl: `src/app/sitemap.ts`, `src/app/robots.ts` (disallow `/app`, `/admin`, `/login`)
- Schema/RLS: `supabase/migrations/001_init.sql` (+ `002_public_catalog.sql`, `003_admin_catalog.sql`)
- Env template: `.env.example` (`NEXT_PUBLIC_*` — must be static `process.env.NEXT_PUBLIC_…` reads in `src/config.ts` so Next inlines them for the client; dynamic env lookups break auth and force demo mode)

- Go-live checklist: `GO_LIVE.md`

## Routes

`/` gallery · `/templates` · `/templates/[slug]` · `/blog` · `/blog/[slug]` · `/login` · `/pricing` · `/terms` · `/privacy` · `/app` projects · `/app/[projectId]` editor · `/admin`

Support: `support@screenshot.design` (footer + legal pages).

## Editor notes

- Canvas: slides side by side in `DesignCanvas`; zoom −/+/Fit (⌘/Ctrl+scroll). **100% = 1:1 artboard pixels**; **Fit** fills the viewport (label shows the real %, e.g. 32%). Steps are at least ±5 percentage points (or ±5% of current). Zoom range 5–400%. Duplicate a slide from the slide actions menu to add another. Device Scale 100% = largest phone that fits the artboard. Artboard scale-root is `position:absolute`; resize handles size from on-screen artboard width. **This size** vs **All sizes**: independent per-size layouts (`sizeLayouts`); **All sizes** copies only the **selected** component onto the same slide in every store size (adapted); switching size resets to **This size** (`src/size-layouts.ts`)
- Frames / cliparts / text / lenses: sized from artboard width + locked aspect; clipart width **1–500%** (Properties slider/number + canvas drag-resize). **Continue** draws overflow onto neighboring slides as guests. Layer order is **per slide**: Move up/down stacks whatever is visible on that slide (including guests from other slides) without changing the owner slide’s order. Phones are no longer forced on top.
- Clipart library: shapes (and Admin-published assets by category, e.g. gestures); clipart can **Attach to phone** so overlays follow device move/scale/tilt (Content → Clipart; Properties)
- Phone screen: Single or Split screen with Split % and Angle ° sliders (CSS gradient convention; full-screen shots clipped along the cut). Device frames share text-style shadow presets (None / Soft / Hard) with blur, offset X/Y, and opacity.
- Lens: free-form rounded magnifier (`slide.lenses`) with independent W/H and corner roundness; border up to 160px; optional **Lock image** captures a slide snapshot (persists through slide edits) while the lens moves; Content → Lens; exports with the slide
- Shortcuts: ⌘/Ctrl+Z undo · ⌘/Ctrl+Shift+Z (or Ctrl+Y) redo · Delete/Backspace removes selection (Mac uses ⌘, Windows/Linux use Ctrl)
- Onboarding: first-run checklist in the editor (upload → template → export); hides on Skip or when all three steps are done (`localStorage` `screenshot-studio:onboarding-v2`); step clicks open the matching left-rail panel
- Text: weight presets, Soft/Hard/None shadow presets (blur, offset X/Y, opacity), outline (stroke) + color in Properties Style; clipart looks: opacity, drop shadow, **blur**, solid/gradient recolor (mask silhouette); gesture presets Hold left/right, Point, Tap when attached
- Text / cliparts / backgrounds as layers (`slide.layerOrder`); library cliparts from Inspector
- Slide templates: under Slide Template, Layouts and Splits are separate sections (hard-edge splits vary by angle + ratio)
- Inspector: left rail (Content / Background / Slide Template / Export) expands a tool panel to the right; canvas center; selected-item Properties on the right in accordion sections (one open at a time; Position / Screen / etc.); thin `.range-thin` sliders with purple fill; actions stay pinned at the bottom
- Export: offscreen capture via `modern-screenshot` in `src/export-canvas.ts`; Free = watermarked single-slide PNG; Pro = clean PNG, ZIP for current size, ZIP for all store sizes **within the project’s orientation**. Portrait and Landscape are separate: pick **Portrait / Landscape** on the projects list (and Home templates); a project cannot switch orientation. Matching store sizes + devices for both (iPhone 6.9/6.5/6.3, iPad 13/11, Play phone). Landscape device IDs (`*-land`) rotate the same phone chrome; do not rotate the screenshot. Gallery seeds 4 portrait + 4 landscape templates (catalog seed v10).
- Uploads: PNG/JPEG/WebP/HEIC — `normalizeImageFile` converts HEIC, downscales longest edge to ≤2400px, re-encodes as WebP (~0.8 quality) before IndexedDB / Supabase to cut storage & egress (keeps original if already smaller JPEG/WebP); unsupported HEIC shows a clear retry message. Screenshots: drag-drop onto a phone frame (incl. split A/B) or onto Add/Replace zones in Properties / Content (`ScreenshotDropZone`)
