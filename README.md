# Screenshot Studio

SaaS editor for App Store and Google Play screenshots. Create up to 5 projects free; subscribe (Stripe or PayPal) to export PNG/ZIP.

```bash
npm install
cp .env.example .env   # optional — leave Supabase empty for local demo mode
npm run dev
```

## Local demo (no Supabase)

Sign in with any email (password ignored). Use `you@admin.local` for admin. Pricing / export paywall can activate **demo Pro** without real charges.

## Production

1. Create a Supabase project; run `supabase/migrations/001_init.sql`, then `002_public_catalog.sql`, then `003_admin_catalog.sql`
2. Enable Auth (Email). Turn **off Confirm email** so sign-up does not send mail (built-in mail is rate-limited). Users sign in with email + password.
3. Create Storage buckets: `project-assets`, `templates`, `cliparts`
4. Deploy Edge Functions under `supabase/functions/` and set Stripe/PayPal secrets
5. Fill `.env` from `.env.example` and deploy the Vite app

Full checkbox list: [`GO_LIVE.md`](./GO_LIVE.md).

See `CONTEXT.md` for architecture and product rules.
