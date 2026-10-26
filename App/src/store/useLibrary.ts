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
import { Collection, PlatformFilter, SavedItem } from '../types';

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
  loading: boolean;
  collectionsLoading: boolean;
  error: string | null;

  setPlatform: (p: PlatformFilter) => void;
  loadItems: (opts?: { force?: boolean }) => Promise<void>;
  loadCollections: () => Promise<void>;
  createCollection: (input: { name: string; emoji: string; description?: string }) => Promise<{ ok: boolean; error?: string; duplicate?: boolean; collection?: Collection }>;
  deleteCollection: (id: string) => Promise<{ ok: boolean; error?: string }>;
  editCollection: (id: string, patch: { name?: string; emoji?: string; description?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  applyUpdateItem: (id: string, patch: ItemPatch) => Promise<{ ok: boolean; error?: string }>;
  applyDeleteItem: (id: string) => Promise<{ ok: boolean; error?: string }>;
  applyTags: (id: string, tags: string[]) => Promise<{ ok: boolean; error?: string }>;
  applyCollections: (itemId: string, ids: string[]) => Promise<{ ok: boolean; error?: string }>;
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  items: [],
  counts: null,
  collections: [],
  platform: 'All',
  loading: false,
  collectionsLoading: false,
  error: null,

  setPlatform: (p) => {
    set({ platform: p });
    void get().loadItems();
  },

  loadItems: async ({ force } = {}) => {
    if (get().loading && !force) return;
    set({ loading: true, error: null });
    const res = await fetchItems({ platform: get().platform, limit: PAGE, offset: 0 });
    if ('error' in res) {
      set({ loading: false, error: res.error });
      return;
    }
    set({ loading: false, items: res.data.items });
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
