# Screenshot Studio

Cloud SaaS App Store / Play screenshot editor (Vite + React). Auth, projects, templates, and clipart catalog use Supabase when configured; otherwise a **local demo backend** (`src/api/local-backend.ts`) keeps the app runnable without env keys.

## Product rules

| Action | Requirement |
|--------|-------------|
| Browse templates / clipart library | Public (thumbnails only; no project created) |
| Create / save / edit projects | Login |
| Create / save / edit projects | Login |
| Max projects per account | **5** (hard cap) |
| PNG preview export | Free (watermarked) |
| Clean PNG / ZIP / all-sizes ZIP | Active monthly subscription |
| Pay | Stripe (card) or PayPal |

## Architecture

- Auth: `src/auth/AuthProvider.tsx` — email magic link (Supabase) or email demo (local)
- Projects: `src/api/projects.ts` — cloud CRUD + 5-cap; editor at `/app/:projectId`. Local demo backend stores projects/assets in **IndexedDB** (migrates off `localStorage` to avoid ~5MB quota errors)
- State: `src/project-store.tsx` — cloud autosave when `projectId` set; IndexedDB fallback when not
- Billing: `src/billing/*` + Edge Functions under `supabase/functions/` (Stripe + PayPal webhooks → `profiles`)
- Catalog: published `templates` + `library_cliparts`; admin at `/admin` (`*@admin.local` in demo). Logged-out visitors can read published templates (RLS + `GRANT SELECT` to `anon`). Landing page falls back to built-in seed templates if the cloud catalog is empty.
  - Templates: design in the editor → Admin → pick project → **Publish as template** (copies assets into `templates/` bucket; generates a multi-slide catalog **thumbnail** of up to 5 slides via `template-preview.ts`, including uploaded screenshots when assets resolve)
- Project list cards show the same multi-slide thumbnail (`thumbnail_path` / `thumbnail_url`), refreshed on save with real screenshots in device frames
  - Local demo seeds 4 portrait + 4 landscape gallery templates (`sample-screens.ts` / `sample-templates.ts`, catalog seed v10). Landscape phones reuse portrait chrome rotated −90°; screenshots stay upright (counter-rotated). Thumbnail device shadows scale with preview size so they match the editor.
- Schema/RLS: `supabase/migrations/001_init.sql`
- Env template: `.env.example`

## Routes

`/` gallery · `/login` · `/pricing` · `/app` projects · `/app/:projectId` editor · `/admin`

## Editor notes

- Canvas: slides side by side in `DesignCanvas`; zoom −/+/Fit (⌘/Ctrl+scroll). **100% = 1:1 artboard pixels**; **Fit** fills the viewport (label shows the real %, e.g. 32%). Steps are ±5% of current size; zoom range 5–400%. Device Scale 100% = largest phone that fits the artboard. Artboard scale-root is `position:absolute`; resize handles size from on-screen artboard width. **This size** vs **All sizes**: independent per-size layouts (`sizeLayouts`); **All sizes** copies only the **selected** component onto the same slide in every store size (adapted); switching size resets to **This size** (`src/size-layouts.ts`)
- Frames / cliparts: sized from artboard width + locked aspect; Continue uses gap-aware `ContinuitySpan` / `ContinuityClipartSpan` (not per-slide guests) so halves align across the slide gap; export still uses `guestFramesForSlide`
- Clipart library: shapes (and Admin-published assets by category, e.g. gestures); clipart can **Attach to phone** so overlays follow device move/scale/tilt (Content → Clipart; Properties)
- Phone screen: Single or Split screen with Split % and Angle ° sliders (CSS gradient convention; full-screen shots clipped along the cut). Device frames share text-style shadow presets (None / Soft / Hard) with blur, offset X/Y, and opacity.
- Lens: free-form rounded magnifier (`slide.lenses`) with independent W/H and corner roundness; border up to 160px; optional **Lock image** captures a slide snapshot (persists through slide edits) while the lens moves; Content → Lens; exports with the slide
- Shortcuts: ⌘/Ctrl+Z undo · ⌘/Ctrl+Shift+Z (or Ctrl+Y) redo · Delete/Backspace removes selection (Mac uses ⌘, Windows/Linux use Ctrl)
- Onboarding: first-run checklist in the editor (upload → template → export); hides on Skip or when all three steps are done (`localStorage` `screenshot-studio:onboarding-v2`); step clicks open the matching left-rail panel
- Text: weight presets, Soft/Hard/None shadow presets (blur, offset X/Y, opacity), outline (stroke) + color in Properties Style; clipart looks: opacity, drop shadow, solid/gradient recolor (mask silhouette); gesture presets Hold left/right, Point, Tap when attached
- Text / cliparts / backgrounds as layers (`slide.layerOrder`); library cliparts from Inspector
- Slide templates: under Slide Template, Layouts and Splits are separate sections (hard-edge splits vary by angle + ratio)
- Inspector: left rail (Content / Background / Slide Template / Export) expands a tool panel to the right; canvas center; selected-item Properties on the right in accordion sections (one open at a time; Position / Screen / etc.); thin `.range-thin` sliders with purple fill; actions stay pinned at the bottom
- Export: offscreen capture via `modern-screenshot` in `src/export-canvas.ts`; Free = watermarked single-slide PNG; Pro = clean PNG, ZIP for current size, ZIP for all store sizes **within the project’s orientation**. Portrait and Landscape are separate: pick **Portrait / Landscape** on the projects list (and Home templates); a project cannot switch orientation. Matching store sizes + devices for both (iPhone 6.9/6.5/6.3, iPad 13/11, Play phone). Landscape device IDs (`*-land`) rotate the same phone chrome; do not rotate the screenshot. Gallery seeds 4 portrait + 4 landscape templates (catalog seed v10).
- Uploads: PNG/JPEG/WebP/HEIC — `normalizeImageFile` converts HEIC, downscales longest edge to ≤2400px, re-encodes as WebP (~0.8 quality) before IndexedDB / Supabase to cut storage & egress (keeps original if already smaller JPEG/WebP); unsupported HEIC shows a clear retry message. Screenshots: drag-drop onto a phone frame (incl. split A/B) or onto Add/Replace zones in Properties / Content (`ScreenshotDropZone`)
