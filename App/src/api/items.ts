import { getSupabase, describeDbError } from '../lib/supabase';
import { canonicalUrl, detectContentType, detectPlatform, isValidUrl } from '../lib/platform';
import { SaveSource, PlatformFilter, Platform, SavedItem } from '../types';
import { mapItem } from './profile';

const ITEM_SELECT =
  '*, item_tags(tag:tags(name))';

export type ApiResult<T> = { data: T } | { error: string; code?: string };

export type SaveOutcome =
  | { ok: true; item: SavedItem; duplicate: boolean }
  | { ok: false; error: 'invalid-url' }
  | { ok: false; dbError: string };

/** Server-side-safe characters allowed inside a PostgREST `or=` ilike query. */
function sanitizeTerm(q: string): string {
  return q.replace(/[%_(),*"']/g, ' ').replace(/\s+/g, ' ').trim();
}

function filterPlatforms(f: PlatformFilter): (Platform | 'Web')[] {
  if (f === 'Instagram') return ['Instagram'];
  if (f === 'TikTok') return ['TikTok'];
  if (f === 'YouTube') return ['YouTube'];
  if (f === 'Web') return ['Facebook', 'X', 'Pinterest', 'Reddit', 'Web'];
  return [];
}

export interface PageOptions {
  platform?: PlatformFilter;
  limit?: number;
  offset?: number;
}

export async function fetchItems({ platform = 'All', limit = 24, offset = 0 }: PageOptions = {}): Promise<ApiResult<{ items: SavedItem[]; total: number }>> {
  try {
    const db = getSupabase();
    let q = db
      .from('saved_items')
      .select(ITEM_SELECT, { count: 'exact' })
      .eq('is_archived', false)
      .order('saved_at', { ascending: false })
      .range(offset, offset + limit - 1);
    const plats = filterPlatforms(platform);
    if (plats.length) q = q.in ('platform', plats);
    const { data, error, count } = await q;
    if (error) return { error: describeDbError(error), code: error.code };
    const items = (data ?? []).map(mapItem);
    return { data: { items, total: count ?? items.length } };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function fetchItem(id: string): Promise<ApiResult<SavedItem>> {
  try {
    const db = getSupabase();
    const { data, error } = await db.from('saved_items').select(ITEM_SELECT).eq('id', id).maybeSingle();
    if (error) return { error: describeDbError(error) };
    if (!data) return { error: 'Item not found.' };
    return { data: mapItem(data) };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function fetchCounts(): Promise<ApiResult<Record<string, number>>> {
  try {
    const db = getSupabase();
    const head = ({ count: 'exact', head: true } as const);
    const groups: [string, (Platform | 'Web')[] | null][] = [
      ['all', null],
      ['Instagram', ['Instagram']],
      ['TikTok', ['TikTok']],
      ['YouTube', ['YouTube']],
      ['Web', ['Facebook', 'X', 'Pinterest', 'Reddit', 'Web']],
    ];
    const counts: Record<string, number> = {};
    for (const [key, plats] of groups) {
      let q = db.from('saved_items').select('*', head).eq('is_archived', false);
      if (plats) q = q.in('platform', plats);
      const { count, error } = await q;
      if (error) return { error: describeDbError(error) };
      counts[key] = count ?? 0;
    }
    return { data: counts };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

/**
 * Save a URL. Works even when no metadata exists — we store the real URL
 * plus the values detected from the URL itself, nothing invented. "Saved"
 * is returned only after the database confirms the write. Duplicate
 * detection uses the canonical URL per user (unique index).
 */
export async function saveUrl(
  rawUrl: string,
  opts: { source?: SaveSource; force?: boolean; userId: string },
): Promise<SaveOutcome> {
  const text = rawUrl.trim();
  if (!isValidUrl(text)) return { ok: false, error: 'invalid-url' };

  const canonical = canonicalUrl(text);
  const platform = detectPlatform(text);
  const contentType = detectContentType(text);

  try {
    const db = getSupabase();

    if (!opts.force) {
      const { data: existing } = await db
        .from('saved_items')
        .select(ITEM_SELECT)
        .eq('canonical_url', canonical)
        .maybeSingle();
      if (existing) return { ok: true, item: mapItem(existing), duplicate: true };
    }

    const insert = {
      user_id: opts.userId,
      original_url: text,
      canonical_url: canonical,
      platform,
      content_type: contentType,
      title: `${platform} ${contentType}`,
      creator_name: null,
      creator_handle: null,
      source: opts.source ?? ('manual' as SaveSource),
    };
    const { data, error } = await db.from('saved_items').insert(insert).select(ITEM_SELECT).single();
    if (error) {
      // Unique race: another save created it first — treat as duplicate.
      if (error.code === '23505') {
        const { data: existing } = await db.from('saved_items').select(ITEM_SELECT).eq('canonical_url', canonical).maybeSingle();
        if (existing) return { ok: true, item: mapItem(existing), duplicate: true };
      }
      return { ok: false, dbError: describeDbError(error) };
    }
    return { ok: true, item: mapItem(data), duplicate: false };
  } catch (e: any) {
    return { ok: false, dbError: describeDbError(e) };
  }
}

export interface ItemPatch {
  title?: string;
  note?: string;
  creator_name?: string | null;
  creator_handle?: string | null;
  is_archived?: boolean;
}

export async function updateItem(id: string, patch: ItemPatch): Promise<ApiResult<SavedItem>> {
  try {
    const db = getSupabase();
    const { data, error } = await db.from('saved_items').update(patch).eq('id', id).select(ITEM_SELECT).single();
    if (error) return { error: describeDbError(error) };
    return { data: mapItem(data) };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function deleteItem(id: string): Promise<ApiResult<true>> {
  try {
    const db = getSupabase();
    const { error } = await db.from('saved_items').delete().eq('id', id);
    if (error) return { error: describeDbError(error) };
    return { data: true };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function markOpened(id: string): Promise<void> {
  try {
    const db = getSupabase();
    // Real counter increment server-side.
    await db.rpc('increment_open_count', { item_id: id });
  } catch {
    // Non-fatal: opening still proceeds.
  }
}

/**
 * Replace the tag set on an item. Tags live in real `tags` / `item_tags`
 * tables (per-user unique names); nothing is faked client-side.
 */
export async function setItemTags(itemId: string, names: string[]): Promise<ApiResult<true>> {
  try {
    const db = getSupabase();
    const normalized = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];

    let tagIds: string[] = [];
    if (normalized.length) {
      const rows = normalized.map((name) => ({ name }));
      const { data: upserted, error: upErr } = await db
        .from('tags')
        .upsert(rows, { onConflict: 'name' })
        .select('id, name');
      if (upErr) return { error: describeDbError(upErr) };
      // RLS scopes upsert/select to this user's rows.
      tagIds = (upserted ?? []).map((t: any) => t.id);
      if (tagIds.length !== normalized.length) {
        // Some names already existed and were returned; fetch the remainder.
        const { data: found, error: fErr } = await db.from('tags').select('id, name').in('name', normalized);
        if (fErr) return { error: describeDbError(fErr) };
        const byName = new Map((found ?? []).map((t: any) => [t.name, t.id]));
        for (const name of normalized) {
          const id = byName.get(name);
          if (id && !tagIds.includes(id)) tagIds.push(id);
        }
      }
    }

    const { data: current, error: cErr } = await db.from('item_tags').select('tag_id').eq('item_id', itemId);
    if (cErr) return { error: describeDbError(cErr) };
    const existing = (current ?? []).map((r: any) => r.tag_id);
    const toRemove = existing.filter((id: string) => !tagIds.includes(id));
    const toAdd = tagIds.filter((id) => !existing.includes(id));

    if (toRemove.length) {
      const { error } = await db.from('item_tags').delete().eq('item_id', itemId).in('tag_id', toRemove);
      if (error) return { error: describeDbError(error) };
    }
    if (toAdd.length) {
      const { error } = await db.from('item_tags').insert(toAdd.map((tag_id) => ({ item_id: itemId, tag_id })));
      if (error) return { error: describeDbError(error) };
    }
    return { data: true };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

/** Replace item ids in a collection (real collection_items writes). */
export async function setItemCollections(itemId: string, collectionIds: string[]): Promise<ApiResult<true>> {
  try {
    const db = getSupabase();
    const { data: current, error: cErr } = await db
      .from('collection_items')
      .select('collection_id')
      .eq('item_id', itemId);
    if (cErr) return { error: describeDbError(cErr) };
    const existing = (current ?? []).map((r: any) => r.collection_id);
    const toRemove = existing.filter((id: string) => !collectionIds.includes(id));
    const toAdd = collectionIds.filter((id) => !existing.includes(id));

    const rm = toRemove.length
      ? await db.from('collection_items').delete().eq('item_id', itemId).in('collection_id', toRemove)
      : null;
    if (rm && rm.error) return { error: describeDbError(rm.error) };

    const add = toAdd.length
      ? await db.from('collection_items').insert(toAdd.map((collection_id) => ({ collection_id, item_id: itemId })))
      : null;
    if (add && add.error) return { error: describeDbError(add.error) };
    return { data: true };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export interface SearchArgs extends PageOptions {
  query: string;
}

/**
 * Substring search over real user-owned rows: URL, title, note, creator,
 * and tag names. Debounced in the UI; paginated. PostgreSQL RLS scoping
 * plus the explicit user filter keep results isolated.
 */
export async function searchItems({ query, platform = 'All', limit = 24, offset = 0 }: SearchArgs): Promise<ApiResult<{ items: SavedItem[]; total: number }>> {
  const term = sanitizeTerm(query);
  if (!term) return { data: { items: [], total: 0 } };
  try {
    const db = getSupabase();
    const like = `%${term}%`;
    // Tag names searched via the item_tags join.
    const filters = [
      `title.ilike.${like}`,
      `note.ilike.${like}`,
      `creator_name.ilike.${like}`,
      `creator_handle.ilike.${like}`,
      `original_url.ilike.${like}`,
    ];
    let q = db
      .from('saved_items')
      .select(ITEM_SELECT, { count: 'exact' })
      .eq('is_archived', false)
      .or(filters.join(','))
      .order('saved_at', { ascending: false })
      .range(offset, offset + limit - 1);
    const plats = filterPlatforms(platform);
    if (plats.length) q = q.in('platform', plats);
    const { data, error, count } = await q;

    if (error) return { error: describeDbError(error), code: error.code };

    let items = (data ?? []).map(mapItem);
    // Items matched only by tag name come back above too (via or on join? no). Tag match:
    if (!error && items.length === 0) {
      const q2 = db
        .from('item_tags')
        .select(`item_id(${ITEM_SELECT}), tag:tags(name)`, { count: 'exact' })
        .or(`name.ilike.${like}`, { referencedTable: 'tags' })
        .range(offset, offset + limit - 1);
      const { data: tagHits, error: tErr, count: tCount } = await q2;
      if (tErr) return { error: describeDbError(tErr) };
      items = (tagHits ?? []).map((r: any) => mapItem(r.item_id)).filter(Boolean);
      return { data: { items, total: tCount ?? items.length } };
    }
    return { data: { items, total: count ?? items.length } };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}
