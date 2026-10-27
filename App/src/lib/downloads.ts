import { Directory, File, Paths } from 'expo-file-system';
import { LocalDownload, SavedItem } from '../types';
import { getDownloads, removeDownload, storeDownload } from './localStore';

const MEDIA_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'webm', 'mp3', 'm4a', 'wav', 'png', 'jpg', 'jpeg', 'gif', 'webp']);
const SOCIAL_HOSTS = [
  'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'facebook.com',
  'x.com', 'twitter.com', 'pinterest.com', 'reddit.com', 'cdninstagram.com',
  'fbcdn.net', 'tiktokcdn.com', 'tiktokv.com', 'googlevideo.com', 'ytimg.com', 'redd.it',
];
const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;

function isSocialHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return SOCIAL_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host === '::1') return true;
  if (/^(0\.|10\.|127\.|169\.254\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)) return true;
  const private172 = host.match(/^172\.(\d+)\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) return true;
  const mappedIpv4 = host.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return Boolean(mappedIpv4 && isLocalHost(mappedIpv4[1]));
}

export function directMediaReason(item: SavedItem): string | null {
  if (item.platform !== 'Web') return 'Downloads are unavailable for social links. KeepItBack stores the link reference.';
  try {
    const url = new URL(item.original_url);
    if (url.protocol !== 'https:' || isSocialHost(url.hostname) || isLocalHost(url.hostname)) return 'Only direct HTTPS media links from the open web can be downloaded.';
    const extension = url.pathname.split('.').pop()?.toLowerCase() ?? '';
    if (!MEDIA_EXTENSIONS.has(extension)) return 'This link is not a direct media file.';
    return null;
  } catch {
    return 'This link is not a valid direct media file.';
  }
}

export async function downloadSavedMedia(item: SavedItem, userId: string): Promise<{ data?: LocalDownload; error?: string }> {
  const reason = directMediaReason(item);
  if (reason) return { error: reason };
  let destination: File | null = null;
  try {
    const url = new URL(item.original_url);
    const extension = url.pathname.split('.').pop()?.toLowerCase() ?? '';
    const head = await fetch(item.original_url, { method: 'HEAD', redirect: 'follow' });
    const finalUrl = head.url ? new URL(head.url) : url;
    if (!head.ok || finalUrl.protocol !== 'https:' || isSocialHost(finalUrl.hostname) || isLocalHost(finalUrl.hostname)) {
      return { error: 'The source did not confirm a direct media file. No download was saved.' };
    }
    const contentType = (head.headers.get('content-type') ?? '').split(';')[0].toLowerCase();
    const allowedType = contentType.startsWith('video/') || contentType.startsWith('audio/') || contentType.startsWith('image/');
    const expectedType = extension === 'mp4' || extension === 'm4v' || extension === 'mov' || extension === 'webm'
      ? contentType.startsWith('video/')
      : extension === 'mp3' || extension === 'm4a' || extension === 'wav'
        ? contentType.startsWith('audio/')
        : contentType.startsWith('image/');
    const size = Number(head.headers.get('content-length') ?? 0);
    if (!allowedType || !expectedType || !Number.isFinite(size) || size <= 0 || size > MAX_DOWNLOAD_BYTES) {
      return { error: 'The source did not confirm a supported media file under 200 MB. No download was saved.' };
    }
    const directory = new Directory(Paths.document, 'KeepItBack', 'media');
    if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
    const safeItemId = item.id.replace(/[^A-Za-z0-9_-]/g, '_');
    destination = new File(directory, `${safeItemId}.${extension}`);
    const file = await File.downloadFileAsync(item.original_url, destination, { idempotent: true });
    if (file.size <= 0 || file.size > MAX_DOWNLOAD_BYTES) {
      file.delete();
      return { error: 'The downloaded file exceeded the supported 200 MB limit and was removed.' };
    }
    const record: LocalDownload = {
      user_id: userId,
      item_id: item.remote_id ?? item.id,
      local_uri: file.uri,
      media_type: contentType,
      file_size: file.size,
      downloaded_at: new Date().toISOString(),
    };
    await storeDownload(record);
    return { data: record };
  } catch {
    try { if (destination?.exists) destination.delete(); } catch { /* Ignore cleanup errors for a partial file. */ }
    return { error: 'Download failed. Check the connection and try again.' };
  }
}

export async function listDownloads(userId: string) {
  const records = await getDownloads(userId);
  const available: LocalDownload[] = [];
  for (const record of records) {
    if (new File(record.local_uri).exists) available.push(record);
    else await removeDownload(userId, record.item_id);
  }
  return available;
}

export async function deleteDownloadedMedia(userId: string, itemId: string) {
  const records = await getDownloads(userId);
  const record = records.find((row) => row.item_id === itemId);
  if (record) {
    const file = new File(record.local_uri);
    if (file.exists) file.delete();
  }
  await removeDownload(userId, itemId);
}
