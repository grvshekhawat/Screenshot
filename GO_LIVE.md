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
  - [ ] `paypal-subscribe` (optional)
  - [ ] `paypal-manage` (optional)
  - [ ] `paypal-webhook` (optional)
- [ ] Function secrets set:
  - [x] `STRIPE_SECRET_KEY`
  - [x] `STRIPE_PRICE_ID`
  - [x] `STRIPE_WEBHOOK_SECRET`
  - [x] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_PLAN_ID`, `PAYPAL_API_BASE` (live)
- [ ] Stripe webhook endpoint → `https://<project>.supabase.co/functions/v1/stripe-webhook` (events for Checkout + subscription lifecycle)
- [ ] Billing Portal enabled in Stripe (for cancel / manage)



## C. Front-end deploy

- [x] Host SPA (Vercel recommended; `vercel.json` SPA rewrite already present)
- [x] Custom domain (e.g. `screenshot.design`) + HTTPS
- [ ] Production env vars (from `.env.example`):
  - [x] `VITE_APP_URL=https://<your-domain>`
  - [x] `VITE_SUPABASE_URL`
  - [x] `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key)
  - [ ] `VITE_BILLING_FUNCTIONS_URL=https://<project>.supabase.co/functions/v1`
  - [ ] `VITE_STRIPE_PUBLISHABLE_KEY` + `VITE_STRIPE_PRICE_ID`
  - [ ] PayPal public ids if enabled
- [ ] `npm run build` succeeds in CI / host
- [ ] Confirm app is **not** in local-demo mode (Supabase URL + key both set)



## D. Catalog / content

- [ ] Sign in as admin → `/admin`
- [ ] Publish at least a few templates (portrait + landscape)
- [ ] Publish clipart / shapes (and gestures if used)
- [ ] Logged-out Home shows templates with strip thumbnails
- [ ] Delete/hide a seed template once to confirm `catalog_hidden_templates` works



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



## F. Soft launch

- [x] Privacy Policy + Terms linked from pricing / footer / signup (`/privacy`, `/terms`)
- [x] Support contact (email or form) — `support@screenshot.design`
- [ ] Stripe / Supabase billing alerts on
- [ ] Smoke on mobile Safari + desktop Chrome
- [ ] Error / uptime glance (Supabase logs, host analytics)
- [ ] Remove or gate any demo-only Pro shortcuts if still present in UI



## G. Launch

- [ ] Final deploy from main
- [ ] DNS live; `VITE_APP_URL` matches canonical URL
- [ ] One full path as a stranger: land → template → signup → edit → export → pay
- [ ] Announce

---

**Rollback:** keep previous Vercel deployment; Supabase migrations are additive — do not drop prod data without a backup.