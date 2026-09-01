-- Storage buckets for admin AI demos + public backgrounds.
-- Safe to re-run. App uses createSignedUrl for both buckets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'demo-screens',
    'demo-screens',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp']::text[]
  ),
  (
    'backgrounds',
    'backgrounds',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp']::text[]
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Admins can upload / update / delete objects in both buckets
drop policy if exists "demo_screens_admin_write" on storage.objects;
create policy "demo_screens_admin_write" on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'demo-screens'
    and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    bucket_id = 'demo-screens'
    and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "backgrounds_admin_write" on storage.objects;
create policy "backgrounds_admin_write" on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'backgrounds'
    and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    bucket_id = 'backgrounds'
    and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Authenticated users can read (signed URLs still go through storage; helps list/download)
drop policy if exists "demo_screens_admin_read" on storage.objects;
create policy "demo_screens_admin_read" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'demo-screens'
    and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "backgrounds_authenticated_read" on storage.objects;
create policy "backgrounds_authenticated_read" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'backgrounds');

-- Anon can read backgrounds (public catalog / marketing) via signed or if made public later
drop policy if exists "backgrounds_anon_read" on storage.objects;
create policy "backgrounds_anon_read" on storage.objects
  for select
  to anon
  using (bucket_id = 'backgrounds');
