-- Screenshot Studio SaaS schema
-- Run in Supabase SQL editor or via supabase db push

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'past_due', 'canceled')),
  subscription_period_end timestamptz,
  billing_provider text check (billing_provider is null or billing_provider in ('stripe', 'paypal')),
  stripe_customer_id text,
  stripe_subscription_id text,
  paypal_subscriber_id text,
  paypal_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects (max 5 per user)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Untitled',
  target_id text not null default 'iphone-69',
  data jsonb not null,
  thumbnail_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);

create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
as $$
declare
  project_count int;
begin
  select count(*) into project_count from public.projects where user_id = new.user_id;
  if tg_op = 'INSERT' and project_count >= 5 then
    raise exception 'Project limit reached (5). Delete a project to create another.';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_limit on public.projects;
create trigger projects_limit
  before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- Templates (public catalog)
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  preview_path text,
  data jsonb not null,
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shared clipart library
create table if not exists public.library_cliparts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'general',
  storage_path text not null,
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.templates enable row level security;
alter table public.library_cliparts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

drop policy if exists "templates_public_read" on public.templates;
drop policy if exists "templates_admin_write" on public.templates;
create policy "templates_public_read" on public.templates
  for select
  to anon, authenticated
  using (published = true);
create policy "templates_admin_write" on public.templates
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "cliparts_public_read" on public.library_cliparts;
drop policy if exists "cliparts_admin_write" on public.library_cliparts;
create policy "cliparts_public_read" on public.library_cliparts
  for select
  to anon, authenticated
  using (published = true);
create policy "cliparts_admin_write" on public.library_cliparts
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

grant usage on schema public to anon, authenticated;
grant select on table public.templates to anon, authenticated;
grant select on table public.library_cliparts to anon, authenticated;

-- Storage buckets (run in dashboard or via API): project-assets, templates, cliparts
-- Example policies for project-assets:
-- authenticated users can read/write under user/{uid}/*
