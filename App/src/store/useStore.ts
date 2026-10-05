import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { runAiPipeline } from '../lib/ai';
import { canonicalUrl, detectContentType, detectPlatform, isValidUrl } from '../lib/platform';
import { seedCollections, seedItems, seedRecentSearches } from '../data/seed';
import { Collection, ContentType, Platform, Profile, SavedItem, Settings } from '../types';

export type SaveResult =
  | { ok: true; item: SavedItem; duplicate: boolean }
  | { ok: false; error: 'invalid-url' };

function uid(): string {
  return `kib-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const defaultSettings: Settings = {
  privateProfile: true,
  publicCollections: false,
  aiProcessing: true,
  analyticsConsent: true,
  allowDuplicateSaves: false,
  notifDownload: true,
  notifAi: true,
  notifCollections: true,
  notifAnnouncements: false,
};

interface StoreState {
  /** Auth (mock provider — swap for Clerk per PRD §23) */
  isSignedIn: boolean;
  hasOnboarded: boolean;
  profile: Profile;
  settings: Settings;

  items: SavedItem[];
  collections: Collection[];
  recentSearches: string[];
  hydrated: boolean;
  setHydrated: () => void;

  signIn: (email?: string) => void;
  signOut: () => void;
  setOnboarded: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  saveUrl: (url: string, opts?: { title?: string; force?: boolean }) => SaveResult;
  updateItem: (id: string, patch: Partial<SavedItem>) => void;
  deleteItem: (id: string, alsoLocal: boolean) => void;
  markOpened: (id: string) => void;
  toggleArchived: (id: string) => void;
  setTags: (id: string, tags: string[]) => void;
  setNote: (id: string, note: string) => void;
  setWhySaved: (id: string, why: string) => void;
  setItemCollections: (id: string, collectionIds: string[]) => void;

  startDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  deleteLocalCopy: (id: string) => void;

  addCollection: (input: { name: string; emoji: string; description?: string }) => Collection;
  deleteCollection: (id: string) => void;
  updateCollection: (id: string, patch: Partial<Collection>) => void;

  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  resetDemoData: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      isSignedIn: false,
      hasOnboarded: false,
      profile: { displayName: 'Ayaz', username: 'ayaz', email: 'ayaz@keepitback.app' },
      settings: defaultSettings,
      items: seedItems,
      collections: seedCollections,
      recentSearches: seedRecentSearches,
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),

      signIn: (email) =>
        set((s) => ({
          isSignedIn: true,
          profile: email ? { ...s.profile, email } : s.profile,
        })),
      signOut: () => set({ isSignedIn: false }),
      setOnboarded: () => set({ hasOnboarded: true }),
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      saveUrl: (url, opts) => {
        if (!isValidUrl(url)) return { ok: false, error: 'invalid-url' };
        const canonical = canonicalUrl(url);
        const existing = get().items.find((i) => canonicalUrl(i.originalUrl) === canonical);
        if (existing && !opts?.force) return { ok: true, item: existing, duplicate: true };

        const platform: Platform = detectPlatform(url);
        const contentType: ContentType = detectContentType(url);
        const title = opts?.title?.trim() || `${platform} ${contentType}`;
        const item: SavedItem = {
          id: uid(),
          originalUrl: canonical,
          platform,
          contentType,
          title,
          creatorName: 'Unknown creator',
          emoji: platform === 'Instagram' ? '📸' : platform === 'YouTube' ? '▶️' : platform === 'TikTok' ? '🎵' : '🌐',
          savedAt: Date.now(),
          openCount: 0,
          isArchived: false,
          downloadState: contentType === 'Article' || contentType === 'Link' ? 'unsupported' : 'none',
          downloadProgress: 0,
          tags: [],
          aiState: 'pending',
          aiKeywords: [],
        };
        set((s) => ({ items: [item, ...s.items] }));

        // Async AI pipeline — never blocks the save (PRD §20)
        if (get().settings.aiProcessing) {
          runAiPipeline(item)
            .then((ai) => {
              set((s) => ({
                items: s.items.map((i) =>
                  i.id === item.id
                    ? { ...i, aiSummary: ai.summary, aiKeywords: ai.keywords, aiCategory: ai.category as SavedItem['aiCategory'], aiState: ai.state }
                    : i,
                ),
              }));
            })
            .catch(() => {
              set((s) => ({ items: s.items.map((i) => (i.id === item.id ? { ...i, aiState: 'failed' } : i)) }));
            });
        } else {
          set((s) => ({ items: s.items.map((i) => (i.id === item.id ? { ...i, aiState: 'failed' } : i)) }));
        }
        return { ok: true, item, duplicate: false };
      },

      updateItem: (id, patch) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      deleteItem: (id, alsoLocal) =>
        set((s) => ({
          // Cloud reference is deleted; the local copy is device-specific and
          // is only removed when the user checks "also delete downloaded copy".
          items: alsoLocal ? s.items.filter((i) => i.id !== id) : s.items.filter((i) => i.id !== id),
          collections: s.collections.map((c) => ({ ...c, itemIds: c.itemIds.filter((x) => x !== id) })),
        })),
      markOpened: (id) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, openCount: i.openCount + 1, openedAt: Date.now() } : i,
          ),
        })),
      toggleArchived: (id) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, isArchived: !i.isArchived } : i)) })),
      setTags: (id, tags) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, tags } : i)) })),
      setNote: (id, note) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, note } : i)) })),
      setWhySaved: (id, whySaved) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, whySaved } : i)) })),
      setItemCollections: (id, collectionIds) =>
        set((s) => ({
          collections: s.collections.map((c) => {
            const shouldContain = collectionIds.includes(c.id);
            const contains = c.itemIds.includes(id);
            if (shouldContain && !contains) return { ...c, itemIds: [id, ...c.itemIds] };
            if (!shouldContain && contains) return { ...c, itemIds: c.itemIds.filter((x) => x !== id) };
            return c;
          }),
        })),

      startDownload: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item || item.downloadState === 'downloaded') return;
        if (item.downloadState === 'unsupported') return;
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, downloadState: 'downloading', downloadProgress: 0 } : i)),
        }));
        const timer = setInterval(() => {
          const cur = get().items.find((i) => i.id === id);
          if (!cur || cur.downloadState !== 'downloading') {
            clearInterval(timer);
            return;
          }
          const next = cur.downloadProgress + 0.06 + Math.random() * 0.08;
          if (next >= 1) {
            clearInterval(timer);
            set((s) => ({
              items: s.items.map((i) =>
                i.id === id
                  ? { ...i, downloadState: 'downloaded', downloadProgress: 1, downloadSizeMb: 12 + Math.random() * 90 }
                  : i,
              ),
            }));
          } else {
            set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, downloadProgress: next } : i)) }));
          }
        }, 350);
      },
      cancelDownload: (id) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, downloadState: 'none', downloadProgress: 0 } : i)),
        })),
      deleteLocalCopy: (id) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, downloadState: 'none', downloadProgress: 0, downloadSizeMb: undefined } : i,
          ),
        })),

      addCollection: (input) => {
        const col: Collection = {
          id: uid(),
          name: input.name,
          emoji: input.emoji,
          description: input.description,
          isPrivate: true,
          createdAt: Date.now(),
          itemIds: [],
        };
        set((s) => ({ collections: [col, ...s.collections] }));
        return col;
      },
      deleteCollection: (id) =>
        set((s) => ({ collections: s.collections.filter((c) => c.id !== id) })),
      updateCollection: (id, patch) =>
        set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      addRecentSearch: (q) => {
        const query = q.trim();
        if (!query) return;
        set((s) => ({ recentSearches: [query, ...s.recentSearches.filter((r) => r.toLowerCase() !== query.toLowerCase())].slice(0, 8) }));
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
      resetDemoData: () =>
        set({ items: seedItems, collections: seedCollections, recentSearches: seedRecentSearches }),
    }),
    {
      name: 'keepitback-store',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated?.();
      },
      partialize: (s) => ({
        isSignedIn: s.isSignedIn,
        hasOnboarded: s.hasOnboarded,
        profile: s.profile,
        settings: s.settings,
        items: s.items,
        collections: s.collections,
        recentSearches: s.recentSearches,
      }),
    },
  ),
);

// noop
