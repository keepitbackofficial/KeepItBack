import { create } from 'zustand';
import {
  fetchCounts,
  fetchItems,
  updateItem as apiUpdateItem,
  deleteItem as apiDeleteItem,
  setItemTags,
  setItemCollections,
  ItemPatch,
} from '../api/items';
import { fetchCollections, createCollection, deleteCollection, updateCollection } from '../api/collections';
import { Collection, PlatformFilter, SavedItem, SearchFilters } from '../types';
import { getActiveUserId } from '../lib/authState';
import { getCachedItems, getPendingLocalItems, getSyncQueueState, mergeCachedItems, pendingOperations } from '../lib/localStore';
import { syncPendingSaves } from '../lib/sync';
import { logProductEvent } from '../api/analytics';
import { listDownloads } from '../lib/downloads';

const PAGE = 24;

/**
 * Client cache for a single real data source: Supabase. This is display
 * state only — every write goes to the database first and loads read the
 * database again. Nothing is seeded, queued, or faked locally.
 */
interface LibraryState {
  items: SavedItem[];
  counts: Record<string, number> | null;
  collections: Collection[];
  platform: PlatformFilter;
  filters: SearchFilters;
  loading: boolean;
  collectionsLoading: boolean;
  error: string | null;
  offline: boolean;
  pendingCount: number;
  syncState: 'idle' | 'pending' | 'syncing' | 'retry';

  setPlatform: (p: PlatformFilter) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  loadItems: (opts?: { force?: boolean; loadMore?: boolean }) => Promise<void>;
  loadCollections: () => Promise<void>;
  createCollection: (input: { name: string; emoji: string; description?: string }) => Promise<{ ok: boolean; error?: string; duplicate?: boolean; collection?: Collection }>;
  deleteCollection: (id: string) => Promise<{ ok: boolean; error?: string }>;
  editCollection: (id: string, patch: { name?: string; emoji?: string; description?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  applyUpdateItem: (id: string, patch: ItemPatch) => Promise<{ ok: boolean; error?: string }>;
  applyDeleteItem: (id: string) => Promise<{ ok: boolean; error?: string }>;
  removeLocalItem: (id: string) => void;
  applyTags: (id: string, tags: string[]) => Promise<{ ok: boolean; error?: string }>;
  applyCollections: (itemId: string, ids: string[]) => Promise<{ ok: boolean; error?: string }>;
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  items: [],
  counts: null,
  collections: [],
  platform: 'All',
  filters: { contentType: 'All', category: 'All', downloadedOnly: false },
  loading: false,
  collectionsLoading: false,
  error: null,
  offline: false,
  pendingCount: 0,
  syncState: 'idle',

  setPlatform: (p) => {
    set({ platform: p, filters: { ...get().filters, platform: p } });
    void get().loadItems();
  },
  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters, platform: filters.platform ?? get().platform } });
    void get().loadItems({ force: true });
  },

  loadItems: async ({ force, loadMore } = {}) => {
    if (get().loading && !force) return;
    set({ loading: true, error: null });
    const userId = getActiveUserId();
    const offset = loadMore ? get().items.length : 0;
    if (userId) {
      try {
        set({ syncState: await getSyncQueueState(userId) });
        if ((await pendingOperations(userId)).length) set({ syncState: 'syncing' });
        await syncPendingSaves(userId);
        const operations = await pendingOperations(userId);
        set({ pendingCount: operations.length, syncState: await getSyncQueueState(userId) });
      } catch {
        // An encrypted local database may be unavailable in Expo Go; remote reads still work.
      }
    }
    const filter = get().filters;
    const res = await fetchItems({
      platform: get().platform,
      contentType: filter.contentType,
      category: filter.category,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      downloadedOnly: filter.downloadedOnly,
      limit: PAGE,
      offset,
    });
    if ('error' in res) {
      if (userId) {
        try {
          const [cached, pending, downloads] = await Promise.all([getCachedItems(userId), getPendingLocalItems(userId), listDownloads(userId)]);
          const downloadIds = new Set(downloads.map((download) => download.item_id));
          const mergedRaw = [...pending, ...cached];
          const overlays = mergedRaw.filter((item) => item.sync_state === 'pending' || item.sync_state === 'error');
          const merged = mergedRaw.map((item) => {
            const overlay = overlays.find((candidate) => candidate.id === item.id || candidate.remote_id === item.id || candidate.canonical_url === item.canonical_url);
            const current = overlay && item.sync_state !== 'pending' && item.sync_state !== 'error'
              ? { ...item, ...overlay, id: item.id, remote_id: undefined }
              : item;
            return { ...current, local_downloaded: downloadIds.has(current.id) || Boolean(current.remote_id && downloadIds.has(current.remote_id)) };
          }).filter((item) => !item.id.startsWith('local:') || !mergedRaw.some((other) => other.id === item.remote_id || (other.canonical_url === item.canonical_url && !other.id.startsWith('local:')))).filter((item) =>
            (get().platform === 'All' || item.platform === get().platform)
            && (!filter.contentType || filter.contentType === 'All' || item.content_type === filter.contentType)
            && (!filter.category || filter.category === 'All' || item.category === filter.category)
            && (!filter.dateFrom || item.saved_at >= filter.dateFrom)
            && (!filter.dateTo || item.saved_at <= `${filter.dateTo}T23:59:59.999Z`)
            && (!filter.downloadedOnly || item.local_downloaded),
          );
          set({ loading: false, items: merged, offline: true, error: null });
          return;
        } catch {
          // Fall through to a visible database/configuration error.
        }
      }
      set({ loading: false, error: res.error, offline: false });
      return;
    }
    const previousItems = loadMore ? get().items : [];
    set({ loading: false, offline: false });
    if (userId) {
      let cached: SavedItem[] = [];
      try { cached = await getCachedItems(userId); } catch { /* Remote library remains usable without local encryption support. */ }
      const downloads = await listDownloads(userId).catch(() => []);
      const downloadIds = new Set(downloads.map((download) => download.item_id));
      const overlays = cached.filter((item) => item.sync_state === 'pending' || item.sync_state === 'error');
      const visibleItems = res.data.items.map((remote) => {
        const local = overlays.find((candidate) => candidate.id === remote.id || candidate.remote_id === remote.id || candidate.canonical_url === remote.canonical_url);
        const merged = local ? { ...remote, ...local, id: remote.id, remote_id: undefined } : remote;
        return { ...merged, local_downloaded: downloadIds.has(remote.id) || Boolean(local?.id && downloadIds.has(local.id)) };
      });
      const allItems = [...previousItems, ...visibleItems];
      set({ items: allItems });
      try { await mergeCachedItems(userId, visibleItems); } catch { /* Remote library remains usable without local encryption support. */ }
      try {
        const [pending, operations] = await Promise.all([
          getPendingLocalItems(userId),
          pendingOperations(userId),
        ]);
        const visiblePending = pending.filter((item) =>
          (get().platform === 'All' || item.platform === get().platform)
          && (!filter.contentType || filter.contentType === 'All' || item.content_type === filter.contentType)
          && (!filter.category || filter.category === 'All' || item.category === filter.category)
          && (!filter.dateFrom || item.saved_at >= filter.dateFrom)
          && (!filter.dateTo || item.saved_at <= `${filter.dateTo}T23:59:59.999Z`)
          && (!filter.downloadedOnly || downloadIds.has(item.id) || Boolean(item.remote_id && downloadIds.has(item.remote_id))),
        ).map((item) => ({ ...item, local_downloaded: downloadIds.has(item.id) || Boolean(item.remote_id && downloadIds.has(item.remote_id)) }));
        set({ items: [...visiblePending, ...allItems.filter((item) => !visiblePending.some((p) => p.canonical_url === item.canonical_url))], pendingCount: operations.length });
      } catch { /* Local queue is an optional device capability. */ }
    } else {
      set({ items: [...previousItems, ...res.data.items] });
    }
    const counts = await fetchCounts();
    if ('data' in counts) set({ counts: counts.data });
  },

  loadCollections: async () => {
    set({ collectionsLoading: true });
    const res = await fetchCollections();
    set({ collectionsLoading: false, collections: res.data ?? [], error: res.error ?? null });
  },

  createCollection: async (input) => {
    const res = await createCollection(input);
    if (res.duplicate) return { ok: false, duplicate: true };
    if (res.error || !res.data) return { ok: false, error: res.error };
    set({ collections: [res.data, ...get().collections] });
    const userId = getActiveUserId();
    if (userId) void logProductEvent(userId, 'collection_created');
    return { ok: true, collection: res.data };
  },

  deleteCollection: async (id) => {
    const res = await deleteCollection(id);
    if (res.error) return { ok: false, error: res.error };
    set({ collections: get().collections.filter((c) => c.id !== id) });
    return { ok: true };
  },

  editCollection: async (id, patch) => {
    const res = await updateCollection(id, patch);
    if (res.error) return { ok: false, error: res.error };
    set({
      collections: get().collections.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    });
    return { ok: true };
  },

  applyUpdateItem: async (id, patch) => {
    const res = await apiUpdateItem(id, patch);
    if ('error' in res) return { ok: false, error: res.error };
    const updated = res.data;
    set({
      // Unarchiving appears once the next real fetch; archiving drops it from
      // the live list so the UI reflects actual database state.
      items: get().items
        .map((i) => (i.id === id ? updated : i))
        .filter((i) => get().platform === 'All' || !i.is_archived),
    });
    return { ok: true };
  },

  applyDeleteItem: async (id) => {
    const res = await apiDeleteItem(id);
    if ('error' in res) return { ok: false, error: res.error };
    set({ items: get().items.filter((i) => i.id !== id) });
    return { ok: true };
  },

  removeLocalItem: (id) => set({ items: get().items.filter((item) => item.id !== id) }),

  applyTags: async (itemId, tags) => {
    const res = await setItemTags(itemId, tags);
    if ('error' in res) return { ok: false, error: res.error };
    set({
      items: get().items.map((i) => (i.id === itemId ? { ...i, tags } : i)),
    });
    return { ok: true };
  },

  applyCollections: async (itemId, ids) => {
    const res = await setItemCollections(itemId, ids);
    if ('error' in res) return { ok: false, error: res.error };
    // Refresh counts on collections after a successful membership write.
    void get().loadCollections();
    return { ok: true };
  },
}));

export type { SavedItem };
