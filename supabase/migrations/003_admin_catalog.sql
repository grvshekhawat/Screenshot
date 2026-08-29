-- Admin catalog writes + hide built-in templates after delete.
-- Run in the Supabase SQL editor (safe to re-run).

create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
as $$
declare
  project_count int;
  user_role text;
begin
  select role into user_role from public.profiles where id = new.user_id;
  if user_role = 'admin' then
    return new;
  end if;
  select count(*) into project_count from public.projects where user_id = new.user_id;
  if tg_op = 'INSERT' and project_count >= 5 then
    raise exception 'Project limit reached (5). Delete a project to create another.';
  end if;
  return new;
end;
$$;

drop policy if exists "templates_admin_write" on public.templates;
create policy "templates_admin_write" on public.templates
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "cliparts_admin_write" on public.library_cliparts;
create policy "cliparts_admin_write" on public.library_cliparts
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

grant insert, update, delete on table public.templates to authenticated;
grant insert, update, delete on table public.library_cliparts to authenticated;

create table if not exists public.catalog_hidden_templates (
  template_id text primary key
);

alter table public.catalog_hidden_templates enable row level security;

drop policy if exists "catalog_hidden_select" on public.catalog_hidden_templates;
create policy "catalog_hidden_select" on public.catalog_hidden_templates
  for select
  to anon, authenticated
  using (true);

drop policy if exists "catalog_hidden_admin" on public.catalog_hidden_templates;
create policy "catalog_hidden_admin" on public.catalog_hidden_templates
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

grant select on table public.catalog_hidden_templates to anon, authenticated;
grant insert, update, delete on table public.catalog_hidden_templates to authenticated;
