/**
 * Download manager (V4 PRD §10). Tracks active, failed and completed
 * download jobs globally so the Downloads screen and item screen show the
 * same state. Prevents duplicate concurrent downloads of the same saved
 * item or URL. State lives in memory on this device — durable state is
 * the encrypted local_downloads record written after verification.
 */
import { create } from 'zustand';
import type { SavedItem } from '../types';
import { downloadVideoForItem, type DownloadProgress } from '../lib/mediaDownload';

export type DownloadJobStage = 'resolving' | 'downloading' | 'error' | 'done';

export interface DownloadJob {
  key: string;
  item: SavedItem;
  stage: DownloadJobStage;
  progress: DownloadProgress;
  error?: string;
  doneUri?: string;
  startedAt: number;
}

interface DownloadsState {
  jobs: Record<string, DownloadJob>;
  aborters: Record<string, AbortController>;
  activeKeys: (itemId: string | undefined, url: string) => string | undefined;
  start: (item: SavedItem, userId: string) => Promise<{ ok: boolean; error?: string; alreadyActive?: boolean }>;
  cancel: (key: string) => Promise<void>;
  clearJob: (key: string) => void;
  onFinished?: (() => void) | null;
}

export const useDownloads = create<DownloadsState>((set, get) => ({
  jobs: {},
  aborters: {},

  activeKeys(itemId, url) {
    const jobs = get().jobs;
    const active = Object.values(jobs).filter((job) => job.stage === 'resolving' || job.stage === 'downloading');
    const byItem = active.find((job) => job.item.id === itemId || job.item.remote_id === itemId);
    if (byItem) return byItem.key;
    return active.find((job) => job.item.original_url === url || job.item.canonical_url === url)?.key;
  },

  async start(item, userId) {
    if (!userId) return { ok: false, error: 'Sign in again to download.' };
    const existing = get().activeKeys(item.remote_id ?? item.id, item.original_url);
    if (existing) return { ok: true, alreadyActive: true };
    if (get().activeKeys(item.id, item.original_url)) return { ok: true, alreadyActive: true };

    const key = `job:${item.remote_id ?? item.id}:${Date.now()}`;
    const aborter = new AbortController();
    set((state) => ({
      jobs: {
        ...state.jobs,
        [key]: {
          key,
          item,
          stage: 'resolving',
          progress: { stage: 'resolving', receivedBytes: 0, totalBytes: null },
          startedAt: Date.now(),
        },
      },
      aborters: { ...state.aborters, [key]: aborter },
    }));

    const patch = (updates: Partial<DownloadJob>) => {
      set((state) => {
        const job = state.jobs[key];
        if (!job) return state;
        return { jobs: { ...state.jobs, [key]: { ...job, ...updates } } };
      });
    };

    const outcome = await downloadVideoForItem(item, userId, {
      signal: aborter.signal,
      onProgress: (progress) => patch({ stage: progress.stage === 'resolving' ? 'resolving' : 'downloading', progress }),
    });

    if (outcome.ok) {
      patch({ stage: 'done', doneUri: outcome.localUri });
      get().onFinished?.();
      return { ok: true };
    }
    if (outcome.cancelled) {
      // Cancel removes the job entirely (V4 PRD §7.3 cleanup).
      set((state) => {
        const { [key]: _removed, ...jobs } = state.jobs;
        const { [key]: _abort, ...aborters } = state.aborters;
        return { jobs, aborters };
      });
      return { ok: false, error: 'cancelled' };
    }
    patch({ stage: 'error', error: outcome.error });
    return { ok: false, error: outcome.error };
  },

  async cancel(key) {
    const aborter = get().aborters[key];
    if (!aborter) return;
    aborter.abort();
  },

  clearJob(key) {
    set((state) => {
      const { [key]: _removed, ...jobs } = state.jobs;
      const { [key]: _abort, ...aborters } = state.aborters;
      return { jobs, aborters };
    });
  },

  onFinished: null,
}));
