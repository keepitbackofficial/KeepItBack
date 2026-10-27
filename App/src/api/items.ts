import { getSupabase, describeDbError } from '../lib/supabase';
import { canonicalUrl, detectContentType, detectPlatform, isValidUrl } from '../lib/platform';
import { SaveSource, PlatformFilter, Platform, SavedItem, SearchFilters } from '../types';
import { mapItem } from './profile';
import type { LinkMetadata } from './linkMetadata';

const ITEM_SELECT =
  '*, item_tags(tag:tags(name))';

export type ApiResult<T> = { data: T } | { error: string; code?: string };

export type SaveOutcome =
  | { ok: true; item: SavedItem; duplicate: boolean }
  | { ok: false; error: 'invalid-url' }
  | { ok: false; dbError: string };

function filterPlatforms(f: PlatformFilter): (Platform | 'Web')[] {
  return f === 'All' ? [] : [f];
}

function exclusiveDateTo(value?: string) {
  if (!value) return undefined;
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(value);
  if (!dateOnly) return value;
  const nextDay = new Date(`${dateOnly[1]}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.toISOString();
}

function uuidIds(values: string[]) {
  return values.filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export interface PageOptions {
  platform?: PlatformFilter;
  contentType?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  downloadedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function fetchItems({ platform = 'All', contentType, category, dateFrom, dateTo, downloadedOnly = false, limit = 24, offset = 0 }: PageOptions = {}): Promise<ApiResult<{ items: SavedItem[]; total: number }>> {
  try {
    const db = getSupabase();
    let downloadedIds: string[] | null = null;
    if (downloadedOnly) {
      const { getActiveUserId } = await import('../lib/authState');
      const userId = getActiveUserId();
      if (!userId) return { data: { items: [], total: 0 } };
      const { listDownloads } = await import('../lib/downloads');
      downloadedIds = uuidIds((await listDownloads(userId)).map((download) => download.item_id));
      if (!downloadedIds.length) return { data: { items: [], total: 0 } };
    }
    let q = db
      .from('saved_items')
      .select(ITEM_SELECT, { count: 'exact' })
      .eq('is_archived', false)
      .order('saved_at', { ascending: false })
      .range(offset, offset + limit - 1);
    const plats = filterPlatforms(platform);
    if (plats.length) q = q.in('platform', plats);
    if (contentType && contentType !== 'All') q = q.eq('content_type', contentType);
    if (category && category !== 'All') q = q.eq('category', category);
    if (dateFrom) q = q.gte('saved_at', dateFrom);
    if (dateTo) q = q.lt('saved_at', exclusiveDateTo(dateTo) ?? dateTo);
    if (downloadedIds) q = q.in('id', downloadedIds);
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
      ['Facebook', ['Facebook']],
      ['X', ['X']],
      ['Pinterest', ['Pinterest']],
      ['Reddit', ['Reddit']],
      ['Web', ['Web']],
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
  opts: { source?: SaveSource; force?: boolean; userId: string; metadata?: LinkMetadata | null },
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
      if (existing) {
        let item = mapItem(existing);
        const metadata = opts.metadata;
        const patch: Record<string, string> = {};
        if (metadata?.title && item.title === `${item.platform} ${item.content_type}`) patch.title = metadata.title;
        if (metadata?.description && !item.description) patch.description = metadata.description;
        if (metadata?.thumbnail_url && !item.thumbnail_url) patch.thumbnail_url = metadata.thumbnail_url;
        if (metadata?.creator_name && !item.creator_name) patch.creator_name = metadata.creator_name;
        if (metadata?.creator_handle && !item.creator_handle) patch.creator_handle = metadata.creator_handle;
        if (Object.keys(patch).length) {
          const { data: enriched, error: enrichError } = await db.from('saved_items')
            .update(patch).eq('id', item.id).select(ITEM_SELECT).maybeSingle();
          if (!enrichError && enriched) item = mapItem(enriched);
          else if (patch.description || patch.thumbnail_url) {
            const baseFields = Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'description' && key !== 'thumbnail_url'));
            if (Object.keys(baseFields).length) {
              const { data: baseEnriched, error: baseError } = await db.from('saved_items')
                .update(baseFields).eq('id', item.id).select(ITEM_SELECT).maybeSingle();
              if (!baseError && baseEnriched) item = mapItem(baseEnriched);
            }
          }
        }
        return { ok: true, item, duplicate: true };
      }
    }

    const insert: Record<string, unknown> = {
      user_id: opts.userId,
      original_url: text,
      canonical_url: canonical,
      platform,
      content_type: contentType,
      title: opts.metadata?.title ?? `${platform} ${contentType}`,
      creator_name: opts.metadata?.creator_name ?? null,
      creator_handle: opts.metadata?.creator_handle ?? null,
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
    let item = mapItem(data);
    const mediaMetadata = {
      ...(opts.metadata?.description ? { description: opts.metadata.description } : {}),
      ...(opts.metadata?.thumbnail_url ? { thumbnail_url: opts.metadata.thumbnail_url } : {}),
    };
    if (Object.keys(mediaMetadata).length) {
      const { data: enriched, error: enrichError } = await db.from('saved_items')
        .update(mediaMetadata).eq('id', item.id).select(ITEM_SELECT).maybeSingle();
      if (!enrichError && enriched) item = mapItem(enriched);
    }
    return { ok: true, item, duplicate: false };
  } catch (e: any) {
    return { ok: false, dbError: describeDbError(e) };
  }
}

export interface ItemPatch {
  title?: string;
  note?: string | null;
  category?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
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
    const { getActiveUserId } = await import('../lib/authState');
    const userId = getActiveUserId();
    if (!userId) return { error: 'Sign in to edit tags.' };
    const db = getSupabase();
    const normalized = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];

    let tagIds: string[] = [];
    if (normalized.length) {
      const rows = normalized.map((name) => ({ user_id: userId, name }));
      const { data: upserted, error: upErr } = await db
        .from('tags')
        .upsert(rows, { onConflict: 'user_id,name' })
        .select('id, name');
      if (upErr) return { error: describeDbError(upErr) };
      // RLS scopes upsert/select to this user's rows.
      tagIds = (upserted ?? []).map((t: any) => t.id);
      if (tagIds.length !== normalized.length) {
        // Some names already existed and were returned; fetch the remainder.
        const { data: found, error: fErr } = await db.from('tags').select('id, name').eq('user_id', userId).in('name', normalized);
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
  filters?: SearchFilters;
}

/**
 * Substring search over real user-owned rows: URL, title, note, creator,
 * and tag names. Debounced in the UI; paginated. PostgreSQL RLS scoping
 * plus the explicit user filter keep results isolated.
 */
export async function searchItems({ query, platform = 'All', contentType, category, dateFrom, dateTo, filters, limit = 24, offset = 0 }: SearchArgs): Promise<ApiResult<{ items: SavedItem[]; total: number }>> {
  const term = query.trim();
  const selectedPlatform = filters?.platform ?? platform;
  const selectedContentType = filters?.contentType ?? contentType;
  const selectedCategory = filters?.category ?? category;
  const selectedDateFrom = filters?.dateFrom ?? dateFrom;
  const selectedDateTo = filters?.dateTo ?? dateTo;
  if (!term && selectedPlatform === 'All' && (!selectedContentType || selectedContentType === 'All') && (!selectedCategory || selectedCategory === 'All') && !selectedDateFrom && !selectedDateTo && !filters?.downloadedOnly) {
    return { data: { items: [], total: 0 } };
  }
  try {
    const db = getSupabase();
    const plats = filterPlatforms(selectedPlatform);
    const { data: hits, error } = await db.rpc('search_saved_items', {
      p_query: term,
      p_platform: plats[0] ?? null,
      p_content_type: selectedContentType && selectedContentType !== 'All' ? selectedContentType : null,
      p_category: selectedCategory && selectedCategory !== 'All' ? selectedCategory : null,
      p_date_from: selectedDateFrom ?? null,
      p_date_to: exclusiveDateTo(selectedDateTo) ?? null,
      p_limit: limit,
      p_offset: offset,
      p_item_ids: filters?.downloadedOnly
        ? await import('../lib/authState').then(async ({ getActiveUserId }) => {
            const userId = getActiveUserId();
            if (!userId) return [];
            const { listDownloads } = await import('../lib/downloads');
            return uuidIds((await listDownloads(userId)).map((download) => download.item_id));
          })
        : null,
    });
    if (error) return { error: describeDbError(error), code: error.code };
    const ids = (hits ?? []).map((row: any) => row.item_id as string);
    if (!ids.length) return { data: { items: [], total: Number(hits?.[0]?.total_count ?? 0) } };
    const { data, error: itemError } = await db.from('saved_items').select(ITEM_SELECT).in('id', ids);
    if (itemError) return { error: describeDbError(itemError), code: itemError.code };
    const byId = new Map((data ?? []).map((row: any) => [row.id, mapItem(row)]));
    let downloadedIds = new Set<string>();
    try {
      const { getActiveUserId } = await import('../lib/authState');
      const userId = getActiveUserId();
      if (userId) {
        const { listDownloads } = await import('../lib/downloads');
        downloadedIds = new Set((await listDownloads(userId)).map((download) => download.item_id));
      }
    } catch { /* Search still works when encrypted local storage is unavailable. */ }
    return {
      data: {
        items: ids.map((id: string) => {
          const item = byId.get(id);
          return item ? { ...item, local_downloaded: downloadedIds.has(id) } : undefined;
        }).filter((item: SavedItem | undefined): item is SavedItem => Boolean(item)),
        total: Number(hits?.[0]?.total_count ?? ids.length),
      },
    };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function fetchCategories(): Promise<ApiResult<string[]>> {
  try {
    const db = getSupabase();
    const { data, error } = await db.from('categories').select('name').order('name');
    if (error) return { error: describeDbError(error) };
    const { data: used, error: usedError } = await db.from('saved_items').select('category').not('category', 'is', null);
    if (usedError) return { error: describeDbError(usedError) };
    return { data: [...new Set([...(data ?? []).map((row: any) => row.name), ...(used ?? []).map((row: any) => row.category)].filter(Boolean))].sort() };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function createCategory(name: string): Promise<ApiResult<string>> {
  const normalized = name.trim();
  if (!normalized) return { error: 'Enter a category name.' };
  try {
    const { getActiveUserId } = await import('../lib/authState');
    const userId = getActiveUserId();
    if (!userId) return { error: 'Sign in to add a category.' };
    const db = getSupabase();
    const { error } = await db.from('categories').upsert({ user_id: userId, name: normalized }, { onConflict: 'user_id,name' });
    if (error) return { error: describeDbError(error) };
    return { data: normalized };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}
