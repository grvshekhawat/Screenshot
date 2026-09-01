-- Library media: admin-only demo phone screens + public slide backgrounds.
-- Run after 001–003. Create Storage buckets `demo-screens` and `backgrounds`
-- (public read for backgrounds; private or signed for demo-screens — app uses signed URLs).

-- App UI mockups for phone frames (admin-only visibility)
create table if not exists public.library_demo_screens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt text not null default '',
  aspect text not null default 'iphone'
    check (aspect in ('iphone', 'ipad')),
  -- Groups the 5 images from one generate call
  batch_id uuid not null,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists library_demo_screens_batch_idx
  on public.library_demo_screens (batch_id);
create index if not exists library_demo_screens_created_idx
  on public.library_demo_screens (created_at desc);

-- Shared slide backgrounds (public when published)
create table if not exists public.library_backgrounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt text not null default '',
  storage_path text not null,
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists library_backgrounds_published_idx
  on public.library_backgrounds (published, sort_order);

alter table public.library_demo_screens enable row level security;
alter table public.library_backgrounds enable row level security;

-- Demos: admins only (no public / non-admin read)
drop policy if exists "demo_screens_admin_all" on public.library_demo_screens;
create policy "demo_screens_admin_all" on public.library_demo_screens
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Backgrounds: anyone can read published; admins write all
drop policy if exists "backgrounds_public_read" on public.library_backgrounds;
drop policy if exists "backgrounds_admin_write" on public.library_backgrounds;
create policy "backgrounds_public_read" on public.library_backgrounds
  for select
  to anon, authenticated
  using (published = true);
create policy "backgrounds_admin_write" on public.library_backgrounds
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

grant select on table public.library_backgrounds to anon, authenticated;
grant insert, update, delete on table public.library_backgrounds to authenticated;
grant select, insert, update, delete on table public.library_demo_screens to authenticated;

-- Storage buckets: see 005_storage_media_buckets.sql (demo-screens, backgrounds).
