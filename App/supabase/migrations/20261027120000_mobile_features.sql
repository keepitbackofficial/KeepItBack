-- Mobile feature extension for KeepItBack.
-- Run manually in the Supabase SQL editor after the baseline migration.
-- This migration is intentionally not executed by the app implementation.

alter table public.saved_items
  add column if not exists description text,
  add column if not exists thumbnail_url text,
  add column if not exists category text;

alter table public.profiles
  add column if not exists analytics_opt_in boolean not null default false,
  add column if not exists notification_preferences jsonb not null
    default '{"download_complete":true,"sync_issues":true,"shared_collection_updates":true}'::jsonb;

alter table public.collections
  add column if not exists is_shared boolean not null default false;

drop index if exists public.saved_items_fts_idx;
alter table public.saved_items drop column if exists fts;
alter table public.saved_items
  add column fts tsvector generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' || coalesce(description,'') || ' ' ||
      coalesce(creator_name,'') || ' ' || coalesce(creator_handle,'') || ' ' ||
      coalesce(note,'') || ' ' || coalesce(category,'') || ' ' || coalesce(original_url,''))
  ) stored;
create index saved_items_fts_idx on public.saved_items using gin (fts);
create index if not exists saved_items_user_category_idx on public.saved_items (user_id, category);
create index if not exists saved_items_user_content_type_idx on public.saved_items (user_id, content_type);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null check (name = btrim(name) and name <> ''),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists categories_user_idx on public.categories (user_id, name);
alter table public.categories enable row level security;
create policy categories_select_self on public.categories for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy categories_insert_self on public.categories for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy categories_update_self on public.categories for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy categories_delete_self on public.categories for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- Collection membership is private and invite-only. Invitation hashes are
-- readable only by server functions using the service role.
create table if not exists public.collection_members (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);
create index if not exists collection_members_user_idx on public.collection_members(user_id, collection_id);

create table if not exists public.collection_invites (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  code_hash text not null unique,
  role text not null check (role in ('editor','viewer')),
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz
);
alter table public.collection_members enable row level security;
alter table public.collection_invites enable row level security;
drop policy if exists collection_members_select_related on public.collection_members;

-- Tag relations must point only to tags owned by the same signed-in user.
drop policy if exists "item_tags_insert_own" on public.item_tags;
create policy item_tags_insert_same_user on public.item_tags for insert to authenticated
  with check (
    exists (select 1 from public.saved_items si where si.id = item_tags.item_id
      and si.user_id = (select auth.jwt() ->> 'sub'))
    and exists (select 1 from public.tags t where t.id = item_tags.tag_id
      and t.user_id = (select auth.jwt() ->> 'sub'))
  );

create or replace function public.current_user_has_collection_role(p_collection_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collection_members cm
    where cm.collection_id = p_collection_id
      and cm.user_id = (select auth.jwt() ->> 'sub')
      and (p_roles is null or cm.role = any(p_roles))
  );
$$;
revoke all on function public.current_user_has_collection_role(uuid,text[]) from public;
grant execute on function public.current_user_has_collection_role(uuid,text[]) to authenticated;

create policy collection_members_select_self on public.collection_members for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
-- No client policies are granted for invite tokens. Edge Functions are the
-- only route to create, accept, revoke, or inspect invite hashes.

create or replace function public.add_collection_owner_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.collection_members(collection_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict (collection_id, user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists collections_owner_member on public.collections;
create trigger collections_owner_member after insert on public.collections
  for each row execute function public.add_collection_owner_member();
insert into public.collection_members(collection_id, user_id, role)
select c.id, c.user_id, 'owner' from public.collections c
on conflict (collection_id, user_id) do nothing;

create policy collections_select_member on public.collections for select to authenticated
  using (public.current_user_has_collection_role(id, null));
create policy collections_update_editor on public.collections for update to authenticated
  using (public.current_user_has_collection_role(id, array['owner']))
  with check (public.current_user_has_collection_role(id, array['owner']));

create policy collection_items_select_member on public.collection_items for select to authenticated
  using (public.current_user_has_collection_role(collection_id, null));
-- Replace the baseline owner-only insert rule: the role-aware rule also checks
-- that every newly shared link belongs to the acting member.
drop policy if exists "collection_items_insert_own" on public.collection_items;
create policy collection_items_insert_editor_own_item on public.collection_items for insert to authenticated
  with check (
    public.current_user_has_collection_role(collection_id, array['owner','editor'])
    and exists (select 1 from public.saved_items si
      where si.id = collection_items.item_id and si.user_id = (select auth.jwt() ->> 'sub'))
  );
create policy collection_items_delete_editor on public.collection_items for delete to authenticated
  using (public.current_user_has_collection_role(collection_id, array['owner','editor']));

-- A shared collection exposes only the fields shown in a shared card. It
-- never exposes the saved item's personal note or tag relations.
create or replace function public.get_shared_collection_items(p_collection_id uuid)
returns table (
  id uuid,
  original_url text,
  canonical_url text,
  platform text,
  content_type text,
  title text,
  description text,
  thumbnail_url text,
  creator_name text,
  creator_handle text,
  category text,
  source text,
  saved_at timestamptz,
  open_count integer,
  is_archived boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  subject text := auth.jwt() ->> 'sub';
begin
  if subject is null or not exists (
    select 1 from public.collection_members cm
    join public.collections c on c.id = cm.collection_id and c.is_shared
    where cm.collection_id = p_collection_id and cm.user_id = subject
  ) then
    raise exception 'Collection not found or access denied';
  end if;
  return query
    select si.id, si.original_url, si.canonical_url, si.platform,
      si.content_type, si.title, si.description, si.thumbnail_url, si.creator_name,
      si.creator_handle, si.category, si.source, si.saved_at, si.open_count, si.is_archived
    from public.collection_items ci
    join public.collections c on c.id = ci.collection_id and c.is_shared
    join public.saved_items si on si.id = ci.item_id
    where ci.collection_id = p_collection_id and si.is_archived = false
    order by ci.added_at desc;
end;
$$;
revoke all on function public.get_shared_collection_items(uuid) from public;
grant execute on function public.get_shared_collection_items(uuid) to authenticated;

-- Accepting an invite locks and consumes it in one transaction, so concurrent
-- requests cannot reuse the same one-time code for multiple accounts.
create or replace function public.accept_collection_invite(p_code_hash text, p_user_id text)
returns table(collection_id uuid, member_role text, already_member boolean)
language plpgsql security definer set search_path = '' as $$
declare
  invite_record public.collection_invites%rowtype;
  existing_role text;
begin
  select * into invite_record
  from public.collection_invites
  where code_hash = p_code_hash
  for update;
  if not found then raise exception 'invalid_invite'; end if;
  if invite_record.accepted_at is not null or invite_record.revoked_at is not null
     or invite_record.expires_at <= now() then
    raise exception 'invalid_invite';
  end if;

  select cm.role into existing_role from public.collection_members cm
  where cm.collection_id = invite_record.collection_id and cm.user_id = p_user_id;
  update public.collection_invites set accepted_at = now() where id = invite_record.id;
  update public.collections set is_shared = true where id = invite_record.collection_id;
  if existing_role is not null then
    return query select invite_record.collection_id, existing_role, true;
    return;
  end if;

  insert into public.collection_members(collection_id, user_id, role)
  values (invite_record.collection_id, p_user_id, invite_record.role);
  return query select invite_record.collection_id, invite_record.role, false;
end;
$$;
revoke all on function public.accept_collection_invite(text,text) from public, anon, authenticated;
grant execute on function public.accept_collection_invite(text,text) to service_role;

-- One lexical search endpoint for all searchable fields and combined filters.
create or replace function public.search_saved_items(
  p_query text,
  p_platform text default null,
  p_content_type text default null,
  p_category text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_item_ids uuid[] default null
)
returns table (item_id uuid, total_count bigint)
language sql security invoker set search_path = '' as $$
  with matching as (
    select si.id, si.saved_at
    from public.saved_items si
    where si.user_id = (select auth.jwt() ->> 'sub')
      and si.is_archived = false
      and (p_platform is null or si.platform = p_platform)
      and (p_content_type is null or si.content_type = p_content_type)
      and (p_category is null or si.category = p_category)
      and (p_date_from is null or si.saved_at >= p_date_from)
      and (p_date_to is null or si.saved_at < p_date_to)
      and (p_item_ids is null or si.id = any(p_item_ids))
      and (
        si.fts @@ websearch_to_tsquery('english', coalesce(p_query, ''))
        or si.title ilike '%' || p_query || '%'
        or coalesce(si.description,'') ilike '%' || p_query || '%'
        or coalesce(si.original_url,'') ilike '%' || p_query || '%'
        or coalesce(si.creator_name,'') ilike '%' || p_query || '%'
        or coalesce(si.creator_handle,'') ilike '%' || p_query || '%'
        or coalesce(si.note,'') ilike '%' || p_query || '%'
        or coalesce(si.category,'') ilike '%' || p_query || '%'
        or exists (
          select 1 from public.item_tags it join public.tags t on t.id = it.tag_id
          where it.item_id = si.id and t.user_id = (select auth.jwt() ->> 'sub')
            and t.name ilike '%' || p_query || '%'
        )
        or exists (
          select 1 from public.collection_items ci join public.collections c on c.id = ci.collection_id
          where ci.item_id = si.id and c.user_id = (select auth.jwt() ->> 'sub')
            and c.name ilike '%' || p_query || '%'
        )
      )
  )
  select matching.id, count(*) over ()
  from matching
  order by matching.saved_at desc
  limit greatest(1, least(coalesce(p_limit, 24), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.search_saved_items(text,text,text,text,timestamptz,timestamptz,integer,integer,uuid[]) from public;
grant execute on function public.search_saved_items(text,text,text,text,timestamptz,timestamptz,integer,integer,uuid[]) to authenticated;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  event_name text not null check (event_name in (
    'account_created','content_saved','content_opened','search_performed',
    'filter_used','collection_created','tag_added','download_started',
    'download_completed','download_deleted','item_deleted','share_extension_used'
  )),
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_user_created_idx on public.analytics_events(user_id, created_at desc);
alter table public.analytics_events enable row level security;
create policy analytics_events_insert_opted_in on public.analytics_events for insert to authenticated
  with check (
    user_id = (select auth.jwt() ->> 'sub')
    and exists (select 1 from public.profiles p where p.user_id = (select auth.jwt() ->> 'sub') and p.analytics_opt_in)
  );
-- No client read policy: aggregate analytics remain server/admin only.

create or replace function public.purge_keepitback_user(p_user_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.collection_invites where created_by = p_user_id
    or collection_id in (select id from public.collections where user_id = p_user_id);
  delete from public.collections where user_id = p_user_id;
  delete from public.collection_members where user_id = p_user_id;
  delete from public.saved_items where user_id = p_user_id;
  delete from public.tags where user_id = p_user_id;
  delete from public.categories where user_id = p_user_id;
  delete from public.analytics_events where user_id = p_user_id;
  delete from public.connected_accounts where user_id = p_user_id;
  delete from public.profiles where user_id = p_user_id;
end;
$$;
revoke all on function public.purge_keepitback_user(text) from public, anon, authenticated;
grant execute on function public.purge_keepitback_user(text) to service_role;

