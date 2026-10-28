import * as Network from 'expo-network';
import * as Crypto from 'expo-crypto';
import { saveUrl, SaveOutcome } from '../api/items';
import type { LinkMetadata } from '../api/linkMetadata';
import { logProductEvent } from '../api/analytics';
import { canonicalUrl, detectContentType, detectPlatform, isValidUrl } from './platform';
import { enqueueOperation, finishOperation, getCachedItems, markOperation, pendingOperations, remapDownload, updateCachedItem } from './localStore';
import { SaveSource, SavedItem } from '../types';

export type SaveWithOfflineOutcome = SaveOutcome | { ok: true; item: SavedItem; duplicate: boolean; queued: true };

async function hasConnection() {
  const state = await Network.getNetworkStateAsync();
  return state.isConnected === true && state.isInternetReachable !== false;
}

function localItem(url: string, userId: string, source: SaveSource): SavedItem {
  const platform = detectPlatform(url);
  const contentType = detectContentType(url);
  return {
    id: `local:${Crypto.randomUUID()}`,
    user_id: userId,
    original_url: url,
    canonical_url: canonicalUrl(url),
    platform,
    content_type: contentType,
    title: `${platform} ${contentType}`,
    creator_name: null,
    creator_handle: null,
    source,
    note: null,
    saved_at: new Date().toISOString(),
    open_count: 0,
    is_archived: false,
    tags: [],
    sync_state: 'pending',
  };
}

async function queueSave(url: string, userId: string, source: SaveSource): Promise<SaveWithOfflineOutcome> {
  try {
    const canonical = canonicalUrl(url);
    const cached = await getCachedItems(userId);
    const existing = cached.find((item) => item.canonical_url === canonical && !item.is_archived);
    if (existing) return { ok: true, item: existing, duplicate: true };

    const operations = await pendingOperations(userId);
    const pending = operations.find((operation) => {
      if (operation.op_type !== 'save_url') return false;
      const payload = operation.payload as { url?: string; item?: SavedItem };
      return Boolean(payload.url && canonicalUrl(payload.url) === canonical && payload.item);
    });
    const pendingItem = (pending?.payload as { item?: SavedItem } | undefined)?.item;
    if (pendingItem) return { ok: true, item: pendingItem, duplicate: true, queued: true };

    const item = localItem(url, userId, source);
    await enqueueOperation(userId, 'save_url', { url, source, item, edited_fields: [] });
    return { ok: true, item, duplicate: false, queued: true };
  } catch (error) {
    return { ok: false, dbError: error instanceof Error ? error.message : 'Offline storage could not queue this save.' };
  }
}

export async function saveUrlWithOffline(
  rawUrl: string,
  options: { userId: string; source: SaveSource; metadata?: LinkMetadata | null },
): Promise<SaveWithOfflineOutcome> {
  const url = rawUrl.trim();
  if (!isValidUrl(url)) return { ok: false, error: 'invalid-url' };
  try {
    if (!(await hasConnection())) return await queueSave(url, options.userId, options.source);
  } catch {
    return await queueSave(url, options.userId, options.source);
  }

  const result = await saveUrl(url, options);
  if (!result.ok) {
    try {
      if (!(await hasConnection())) return await queueSave(url, options.userId, options.source);
    } catch {
      return await queueSave(url, options.userId, options.source);
    }
  }
  return result;
}

export async function syncPendingSaves(userId: string) {
  if (!(await hasConnection())) return { synced: 0, pending: 0 };
  const operations = await pendingOperations(userId);
  let synced = 0;
  for (const operation of operations) {
    await markOperation(operation.id, 'syncing');
    const payload = operation.payload as { url?: string; source?: SaveSource; item?: SavedItem; canonical_url?: string; patch?: Record<string, unknown>; edited_fields?: string[] };
    if (operation.op_type === 'delete_item') {
      const { getSupabase } = await import('./supabase');
      const { error } = await getSupabase().from('saved_items').delete()
        .eq('canonical_url', payload.canonical_url ?? '').eq('user_id', userId);
      if (error) {
        await markOperation(operation.id, 'error', 'The delete is still waiting to sync.');
        break;
      }
      await finishOperation(operation.id);
      synced += 1;
      continue;
    }
    if (operation.op_type === 'update_item') {
      const { getSupabase } = await import('./supabase');
      const dbResult = await getSupabase()
        .from('saved_items')
        .select('id')
        .eq('user_id', userId)
        .eq('canonical_url', payload.canonical_url ?? '')
        .maybeSingle();
      if (dbResult.error || !dbResult.data) {
        await markOperation(operation.id, 'error', 'The saved link is still waiting to sync.');
        break;
      }
      const { fetchItem, setItemTags, updateItem } = await import('../api/items');
      const patch = payload.patch ?? {};
      const { tags, ...fields } = patch as Record<string, unknown> & { tags?: string[] };
      let syncedItem: SavedItem | undefined;
      if (Object.keys(fields).length) {
        const updated = await updateItem(dbResult.data.id, fields);
        if ('error' in updated) {
          await markOperation(operation.id, 'error', updated.error);
          break;
        }
        syncedItem = updated.data;
      }
      if (tags) {
        const tagResult = await setItemTags(dbResult.data.id, tags);
        if ('error' in tagResult) {
          await markOperation(operation.id, 'error', tagResult.error);
          break;
        }
        if (syncedItem) syncedItem = { ...syncedItem, tags };
        else {
          const fetched = await fetchItem(dbResult.data.id);
          if ('error' in fetched) {
            await markOperation(operation.id, 'error', fetched.error);
            break;
          }
          syncedItem = { ...fetched.data, tags };
        }
      }
      if (syncedItem) {
        const cachedItems = await getCachedItems(userId);
        const matchingItems = cachedItems.filter((item) => item.canonical_url === payload.canonical_url);
        for (const cached of matchingItems) await updateCachedItem(userId, {
          ...syncedItem,
          id: cached.id,
          remote_id: cached.id.startsWith('local:') ? dbResult.data.id : undefined,
          sync_state: 'synced',
        });
      }
      await finishOperation(operation.id);
      synced += 1;
      continue;
    }
    const result = await saveUrl(payload.url ?? '', { userId, source: payload.source ?? 'manual' });
    if (result.ok) {
      let syncedItem = result.item;
      const edited = new Set(payload.edited_fields ?? []);
      if (payload.item && edited.size) {
        const { setItemTags, updateItem } = await import('../api/items');
        const editableFields = ['title', 'note', 'category', 'description'] as const;
        const patch = Object.fromEntries(editableFields
          .filter((field) => edited.has(field))
          .map((field) => [field, payload.item?.[field] ?? null]));
        if (Object.keys(patch).length) {
          const update = await updateItem(result.item.id, patch);
          if ('error' in update) {
            await markOperation(operation.id, 'error', update.error);
            break;
          }
          syncedItem = update.data;
        }
        if (edited.has('tags')) {
          const tagResult = await setItemTags(result.item.id, payload.item.tags ?? []);
          if ('error' in tagResult) {
            await markOperation(operation.id, 'error', tagResult.error);
            break;
          }
          syncedItem = { ...syncedItem, tags: payload.item.tags ?? [] };
        }
      }
      if (payload.item) {
        const localAlias = { ...syncedItem, id: payload.item.id, remote_id: syncedItem.id, sync_state: 'synced' as const };
        await updateCachedItem(userId, localAlias);
        await updateCachedItem(userId, { ...syncedItem, sync_state: 'synced' as const });
        if (payload.item.id.startsWith('local:')) await remapDownload(userId, payload.item.id, syncedItem.id);
      }
      if (!result.duplicate) void logProductEvent(userId, 'content_saved');
      if (payload.source === 'share_extension' && !result.duplicate) void logProductEvent(userId, 'share_extension_used');
      await finishOperation(operation.id);
      synced += 1;
    } else {
      await markOperation(operation.id, 'error', 'Waiting for a working connection.');
      break;
    }
  }
  return { synced, pending: operations.length - synced };
}
