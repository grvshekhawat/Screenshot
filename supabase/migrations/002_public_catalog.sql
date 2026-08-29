-- Public catalog: logged-out visitors must be able to read published templates.
-- Run in the Supabase SQL editor if 001 was already applied.

drop policy if exists "templates_public_read" on public.templates;
create policy "templates_public_read" on public.templates
  for select
  to anon, authenticated
  using (published = true);

drop policy if exists "cliparts_public_read" on public.library_cliparts;
create policy "cliparts_public_read" on public.library_cliparts
  for select
  to anon, authenticated
  using (published = true);

grant usage on schema public to anon, authenticated;
grant select on table public.templates to anon, authenticated;
grant select on table public.library_cliparts to anon, authenticated;
