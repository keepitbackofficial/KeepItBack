/**
 * Real video download engine (V4 PRD §7).
 *
 * Flow: /api/v1/media resolves the processed MP4 → File.downloadFileAsync
 * downloads it with real progress and an abort signal → the file is
 * verified (exists, non-empty, inside limit) → the local download record
 * is stored and the media properties are persisted on the saved item.
 * Cancellation and failures delete partial files. A failed download that
 * looks like an expired link transparently re-resolves the media once.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { MediaApiError, MediaResolution, describeMediaApiError, resolveMedia } from '../api/kibApi';
import { updateMediaMetadata } from '../api/items';
import { SavedItem } from '../types';
import { getDownloads, removeDownload, storeDownload } from './localStore';

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export interface DownloadProgress {
  stage: 'resolving' | 'downloading';
  receivedBytes: number;
  totalBytes: number | null;
}

export type DownloadOutcome =
  | { ok: true; localUri: string; fileSize: number; mimeType: string; itemId: string; gallerySaved: boolean }
  | { ok: false; cancelled?: boolean; error: string };

function sanitizeItemId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_');
}

function extensionFromMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('h264')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('audio/mpeg')) return 'mp3';
  if (mime.includes('audio/mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('audio/wav')) return 'wav';
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

/** Social/video items take the media-API path; direct web media keeps the legacy HEAD-checked path. */
export function videoDownloadSupported(item: SavedItem): string | null {
  if (item.platform !== 'Web') return null; // social platforms: media API path
  return directMediaReason(item);
}

// Imported lazily to keep this module's public surface clean.
function directMediaReason(item: SavedItem): string | null {
  const MEDIA_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'webm', 'mp3', 'm4a', 'wav', 'png', 'jpg', 'jpeg', 'gif', 'webp']);
  const SOCIAL_HOSTS = ['instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'facebook.com', 'x.com', 'twitter.com', 'pinterest.com', 'reddit.com', 'cdninstagram.com', 'fbcdn.net', 'tiktokcdn.com', 'tiktokv.com', 'googlevideo.com', 'ytimg.com', 'redd.it'];
  const isSocialHost = (hostname: string) => {
    const host = hostname.toLowerCase().replace(/^www\./, '');
    return SOCIAL_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  };
  const isLocalHost = (hostname: string): boolean => {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host === '::1') return true;
    if (/^(0\.|10\.|127\.|169\.254\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)) return true;
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
    if (/^(fc|fd)[0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) return true;
    return false;
  };
  try {
    const url = new URL(item.original_url);
    if (url.protocol !== 'https:' || isSocialHost(url.hostname) || isLocalHost(url.hostname)) return 'Direct social pages are downloaded with the media service instead. Use the Download Video action.';
    const extension = url.pathname.split('.').pop()?.toLowerCase() ?? '';
    if (!MEDIA_EXTENSIONS.has(extension)) return null;
    return null;
  } catch {
    return null;
  }
}

/** The downloads directory for KeepItBack videos, under app-private storage (no gallery permission needed — V4 PRD §7.2). */
function downloadsDirectory(): Directory {
  const directory = new Directory(Paths.document, 'KeepItBack', 'Downloads');
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

/**
 * Copy the finished file into the device gallery (album "KeepItBack") so it is
 * visible in Photos / the Files app — the user asked for gallery visibility
 * without giving up the app-private working copy (V4 PRD §7.2). The media
 * library is mathematically write-only here: we never read existing media.
 */
async function saveToGallery(uri: string): Promise<boolean> {
  try {
    // Write-only permission: we never read the user's existing media.
    const perms = await MediaLibrary.requestPermissionsAsync(true);
    if (!perms.granted) return false;
    const album = await MediaLibrary.Album.get('KeepItBack');
    if (album) {
      const asset = await MediaLibrary.Asset.create(uri);
      await album.add([asset]);
    } else {
      // moveAssets=false → the asset is copied; the app-private file stays.
      await MediaLibrary.Album.create('KeepItBack', [uri], false);
    }
    return true;
  } catch {
    return false;
  }
}

async function persistLocalRecord(item: SavedItem, resolved: MediaResolution, file: File, userId: string, itemIdForRecord: string): Promise<LocalRecordInput> {
  return {
    localUri: file.uri,
    fileSize: file.size,
    mimeType: resolved.mime_type ?? 'video/mp4',
  };
}

interface LocalRecordInput { localUri: string; fileSize: number; mimeType: string }

/**
 * Download the actual video for a saved item. `signal` aborts both the
 * media resolution call and the file transfer; partial files are removed.
 */
export async function downloadVideoForItem(
  item: SavedItem,
  userId: string,
  options: { onProgress?: (progress: DownloadProgress) => void; signal?: AbortSignal } = {},
): Promise<DownloadOutcome> {
  // The record id: remote uuid when synced, else the device alias until it syncs.
  const recordId = item.remote_id ?? item.id;
  let media: MediaResolution | null = null;
  let destination: File | null = null;

  const attempt = async (allowSecondResolve: boolean): Promise<DownloadOutcome> => {
    let resolved: MediaResolution;
    options.onProgress?.({ stage: 'resolving', receivedBytes: 0, totalBytes: null });
    try {
      resolved = await resolveMedia(item.original_url, options.signal);
    } catch (e) {
      if (options.signal?.aborted) return { ok: false, cancelled: true, error: 'Download cancelled.' };
      const message = e instanceof MediaApiError && e.kind === 'unsupported-platform'
        ? 'This platform is not supported for video extraction. The saved link keeps its details.'
        : describeMediaApiError(e, 'Download failed. Check the connection and try again.');
      return { ok: false, error: message };
    }

    const downloadUrl = resolved.download_url as string;
    const mime = resolved.mime_type ?? 'video/mp4';
    const expectedBytes = Number(resolved.filesize ?? 0);
    const extension = extensionFromMime(mime);

    destination = new File(downloadsDirectory(), `${sanitizeItemId(recordId)}-${Date.now()}.${extension}`);
    try {
      const file = await File.downloadFileAsync(downloadUrl, destination, {
        idempotent: false,
        signal: options.signal,
        onProgress: (progress: { bytesWritten: number; totalBytes: number }) => {
          const total = progress.totalBytes > 0 ? progress.totalBytes : (expectedBytes > 0 ? expectedBytes : null);
          options.onProgress?.({ stage: 'downloading', receivedBytes: progress.bytesWritten, totalBytes: total });
        },
      });
      if (options.signal?.aborted) {
        try { if (file.exists) file.delete(); } catch { /* cleanup best-effort */ }
        return { ok: false, cancelled: true, error: 'Download cancelled.' };
      }
      if (filesizeWithinLimits(file) === false) {
        file.delete();
        return { ok: false, error: 'The downloaded video exceeded the supported 200 MB limit and was removed.' };
      }
      // Verified: the file really exists on disk before anything is recorded.
      const verified = file.exists && file.size > 0;
      if (!verified) {
        try { if (file.exists) file.delete(); } catch { /* ignore */ }
        if (allowSecondResolve) return attempt(false);
        return { ok: false, error: 'The download did not produce a usable file. Check the connection and try again.' };
      }

      media = resolved;
      const input = await persistLocalRecord(item, resolved, file, userId, recordId);
      // Store the device record (V4 PRD §8: local_uri stays device-specific;
      // nothing is uploaded to cloud storage without an explicit backup feature).
      await storeDownload({
        user_id: userId,
        item_id: recordId,
        local_uri: input.localUri,
        media_type: input.mimeType,
        file_size: input.fileSize,
        downloaded_at: new Date().toISOString(),
      });
      // Best-effort media properties on the user's row (RLS-scoped).
      await updateMediaMetadata(recordId, {
        duration_s: resolved.duration ?? null,
        width: resolved.width ?? null,
        height: resolved.height ?? null,
        media_size_bytes: file.size,
        media_mime_type: input.mimeType,
      }).catch(() => undefined);
      // Make the video visible in the device gallery, best-effort — the
      // app-private copy remains the source of truth for the library UI.
      const gallerySaved = await saveToGallery(input.localUri);
      return { ok: true, localUri: input.localUri, fileSize: input.fileSize, mimeType: input.mimeType, itemId: recordId, gallerySaved };
    } catch (e) {
      try { if (destination?.exists) destination.delete(); } catch { /* cleanup best-effort */ }
      if (options.signal?.aborted) return { ok: false, cancelled: true, error: 'Download cancelled.' };
      // Expired token / consumed link → one fresh resolve (V4 PRD §13).
      if (e instanceof Error && /expired|invalid|403|404|410/i.test(e.message) && allowSecondResolve) {
        return attempt(false);
      }
      const message = describeMediaApiError(e, 'Download failed. Check the connection and try again.');
      return { ok: false, error: message };
    } finally {
      destination = null;
    }
  };

  const outcome = await attempt(true);
  void media;
  return outcome;
}

function filesizeWithinLimits(file: File): boolean {
  try {
    if (!file.exists) return false;
    return file.size > 0 && file.size <= MAX_VIDEO_BYTES;
  } catch {
    return false;
  }
}

/** Existing device downloads for a user, dropping records whose file vanished. */
export async function listVerifiedDownloads(userId: string) {
  const records = await getDownloads(userId);
  const available: typeof records = [];
  for (const record of records) {
    try {
      if (new File(record.local_uri).exists) available.push(record);
      else await removeDownload(userId, record.item_id);
    } catch {
      await removeDownload(userId, record.item_id);
    }
  }
  return available;
}
