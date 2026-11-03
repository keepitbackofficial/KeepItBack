-- KeepItBack V4 — media-download metadata
-- Run manually via the Supabase SQL Editor (do NOT execute automatically).
-- Extends saved_items with video properties produced by the KeepItBack
-- Media API and real downloads. Safe to run on an existing database; it
-- adds nullable columns only and touches no existing data.

-- ---------------------------------------------------------------------------
-- media properties from /api/v1/resolve and completed device downloads
-- ---------------------------------------------------------------------------
alter table public.saved_items
  add column if not exists duration_s double precision,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists media_size_bytes bigint,
  add column if not exists media_mime_type text,
  add column if not exists platform_id text;

-- content search should surface platform ids (e.g. Instagram shortcode).
-- Keep the generated FTS in sync with the original migration's definition.
alter table public.saved_items drop column if exists fts;
alter table public.saved_items
  add column fts tsvector generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' || coalesce(creator_name,'') || ' ' ||
      coalesce(creator_handle,'') || ' ' || coalesce(note,'') || ' ' ||
      coalesce(category,'') || ' ' || coalesce(original_url,'') || ' ' ||
      coalesce(platform_id,''))
  ) stored;

create index if not exists saved_items_fts_idx
  on public.saved_items using gin (fts);
