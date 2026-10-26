-- KeepItBack baseline schema
-- Generated for PRD v2 §8. Run manually via the Supabase SQL Editor.
--
-- Identity model:
--   Clerk is the identity provider. Supabase third-party auth must be
--   configured (Supabase Dashboard → Authentication → Third-Party Auth →
--   Clerk) so that Clerk-issued JWTs are trusted and every request carries
--   `auth.jwt()->>'sub'` = the Clerk user id (text).
--   Clerk user IDs are TEXT everywhere — never cast `sub` to UUID
--   (do NOT use auth.uid(); it casts to uuid and fails for Clerk subjects).

-- ---------------------------------------------------------------------------
-- extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto; -- gen_random_uuid()
-- Full-text search lives in a generated tsvector column below (english).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id      text primary key,
  display_name text,
  email        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- saved_items
-- ---------------------------------------------------------------------------
create table if not exists public.saved_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  original_url   text not null,
  canonical_url  text not null,
  platform       text not null,
  content_type   text not null,
  title          text not null,
  creator_name   text,
  creator_handle text,
  source         text not null default 'manual'
                 check (source in ('manual','share_extension','instagram_dm','account_import')),
  note           text,
  saved_at       timestamptz not null default now(),
  opened_at      timestamptz,
  open_count     integer not null default 0,
  is_archived    boolean not null default false,
  fts tsvector generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' || coalesce(creator_name,'') || ' ' ||
      coalesce(creator_handle,'') || ' ' || coalesce(note,''))
  ) stored
);

create unique index if not exists saved_items_user_canonical_uq
  on public.saved_items (user_id, canonical_url);
create index if not exists saved_items_user_saved_at_idx
  on public.saved_items (user_id, saved_at desc);
create index if not exists saved_items_user_platform_idx
  on public.saved_items (user_id, platform);
create index if not exists saved_items_fts_idx
  on public.saved_items using gin (fts);

-- ---------------------------------------------------------------------------
-- tags / item_tags
-- ---------------------------------------------------------------------------
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  name       text not null check (name = lower(name) and name <> ''),
  created_at timestamptz not null default now()
);

create unique index if not exists tags_user_name_uq on public.tags (user_id, name);
create index if not exists tags_user_idx on public.tags (user_id);

create table if not exists public.item_tags (
  item_id uuid not null references public.saved_items (id) on delete cascade,
  tag_id  uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);

create index if not exists item_tags_tag_idx on public.item_tags (tag_id);

-- ---------------------------------------------------------------------------
-- collections / collection_items
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  emoji       text not null default '📁',
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists collections_user_name_uq on public.collections (user_id, name);
create index if not exists collections_user_created_idx on public.collections (user_id, created_at desc);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  item_id       uuid not null references public.saved_items (id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, item_id)
);

create index if not exists collection_items_item_idx on public.collection_items (item_id);

-- ---------------------------------------------------------------------------
-- connected_accounts (private, per user)
-- ---------------------------------------------------------------------------
create table if not exists public.connected_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             text not null,
  provider            text not null check (provider in ('instagram')),
  -- Instagram-scoped sender id (IGSID) from the Messaging webhook payload.
  -- Never a display name; usernames cannot reliably identify a sender.
  provider_account_id text not null,
  provider_username   text,
  linked_at           timestamptz not null default now()
);

create unique index if not exists connected_accounts_provider_account_uq
  on public.connected_accounts (provider, provider_account_id);
create index if not exists connected_accounts_user_idx on public.connected_accounts (user_id);

-- ---------------------------------------------------------------------------
-- account_link_codes — SERVER-ONLY. RLS is enabled with NO policies, so
-- anon/authenticated clients (Clerk or Supabase keys in the app) can never
-- read code hashes. Only the service role (Edge Functions) accesses this.
-- ---------------------------------------------------------------------------
create table if not exists public.account_link_codes (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null check (provider in ('instagram')),
  provider_account_id text not null,
  -- Only an HMAC/SHA-256 hash of the one-time code is stored. Never a plaintext code.
  code_hash           text not null,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  used_at             timestamptz
);

-- one outstanding code per linked-DM sender at a time
create unique index if not exists account_link_codes_open_uq
  on public.account_link_codes (provider, provider_account_id)
  where used_at is null;

-- ---------------------------------------------------------------------------
-- webhook_events — SERVER-ONLY (same RLS posture): Meta webhook ingestion
-- idempotency ledger keyed by Meta event id.
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null unique,
  payload     jsonb not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- open-count increment (called by the client after marking an item opened)
-- SECURITY DEFINER with a locked search_path; ownership is re-checked
-- against auth.jwt()->>'sub' so a user can only bump their own row.
-- ---------------------------------------------------------------------------
create or replace function public.increment_open_count(item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.saved_items
     set open_count = open_count + 1,
         opened_at = now()
   where id = item_id
     and user_id = auth.jwt() ->> 'sub';
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS on every user-owned table. Policies compare user_id (TEXT) to the
-- verified Clerk JWT subject. `to authenticated` requires a trusted token,
-- which Supabase validates with the configured third-party provider keys.
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.saved_items         enable row level security;
alter table public.tags                enable row level security;
alter table public.item_tags           enable row level security;
alter table public.collections         enable row level security;
alter table public.collection_items    enable row level security;
alter table public.connected_accounts  enable row level security;
alter table public.account_link_codes  enable row level security;
alter table public.webhook_events      enable row level security;

-- (Anon/public access is denied everywhere: RLS is enabled and every
-- policy is scoped `to authenticated`.)

-- profiles: strict self-matching (compare text sub, no auth.uid() cast)
create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "profiles_delete_self" on public.profiles
  for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- owned row checks: shared template via per-table policies
create policy "saved_items_select_self" on public.saved_items
  for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy "saved_items_insert_self" on public.saved_items
  for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "saved_items_update_self" on public.saved_items
  for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "saved_items_delete_self" on public.saved_items
  for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

create policy "tags_select_self" on public.tags
  for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy "tags_insert_self" on public.tags
  for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));
-- upsert needs update path too (on conflict do update)
create policy "tags_update_self" on public.tags
  for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "tags_delete_self" on public.tags
  for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- item_tags / collection_items: parent-row ownership via join
create policy "item_tags_select_own" on public.item_tags
  for select to authenticated
  using (exists (
    select 1 from public.saved_items si
    where si.id = item_tags.item_id
      and si.user_id = (select auth.jwt() ->> 'sub')));
create policy "item_tags_insert_own" on public.item_tags
  for insert to authenticated
  with check (exists (
    select 1 from public.saved_items si
    where si.id = item_tags.item_id
      and si.user_id = (select auth.jwt() ->> 'sub')));
create policy "item_tags_delete_own" on public.item_tags
  for delete to authenticated
  using (exists (
    select 1 from public.saved_items si
    where si.id = item_tags.item_id
      and si.user_id = (select auth.jwt() ->> 'sub')));

create policy "collections_select_self" on public.collections
  for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy "collections_insert_self" on public.collections
  for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "collections_update_self" on public.collections
  for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "collections_delete_self" on public.collections
  for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

create policy "collection_items_select_own" on public.collection_items
  for select to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_items.collection_id
      and c.user_id = (select auth.jwt() ->> 'sub')));
create policy "collection_items_insert_own" on public.collection_items
  for insert to authenticated
  with check (exists (
    select 1 from public.collections c
    where c.id = collection_items.collection_id
      and c.user_id = (select auth.jwt() ->> 'sub')));
create policy "collection_items_delete_own" on public.collection_items
  for delete to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_items.collection_id
      and c.user_id = (select auth.jwt() ->> 'sub')));

-- connected_accounts: users see only their own links; inserting requires the
-- Edge Function (service role). Clients cannot self-register connections.
create policy "connected_accounts_select_self" on public.connected_accounts
  for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- account_link_codes / webhook_events: RLS enabled with NO policies
-- (deny by default) — only service role (Edge Functions) may touch them.
