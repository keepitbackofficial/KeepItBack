/**
 * KeepItBack Metadata API client (V4 PRD §4).
 *
 * Single integration point for the live media service:
 *   GET https://eqwxy.aiccloud.online/api/v1/resolve?url=...   → metadata
 *   GET https://eqwxy.aiccloud.online/api/v1/media?url=...    → processed MP4 + temporary download URL
 *   GET https://eqwxy.aiccloud.online/api/v1/media/download/TOKEN → the video itself
 *
 * Error strings for the UI are classified here so screens can show the
 * exact behavior required by V4 PRD §13 (unsupported platform, expired
 * download URL, rate limit, network failure) without parsing internals.
 */

export const KIB_API_BASE = 'https://eqwxy.aiccloud.online';

export type MediaApiErrorKind =
  | 'invalid-url'
  | 'unsupported-platform'
  | 'metadata-unavailable'
  | 'media-unavailable'
  | 'rate-limited'
  | 'timeout'
  | 'network';

export class MediaApiError extends Error {
  kind: MediaApiErrorKind;
  status?: number;

  constructor(kind: MediaApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'MediaApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** User-facing message per classification (V4 PRD §13). */
export function describeMediaApiError(error: unknown, fallback: string): string {
  if (error instanceof MediaApiError) {
    switch (error.kind) {
      case 'invalid-url':
        return 'That link is not a valid social-media URL.';
      case 'unsupported-platform':
        return 'This platform is not supported for video extraction. The link is still saved as a reference.';
      case 'media-unavailable':
        return 'No downloadable video was found for this link. The saved link keeps its details.';
      case 'rate-limited':
        return 'The media service is busy right now. Try again in a minute.';
      case 'timeout':
        return 'The media service took too long to respond. Try again.';
      case 'network':
        return 'Could not reach the media service. Check the connection and try again.';
      case 'metadata-unavailable':
        return 'Metadata is unavailable for this link.';
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface ResolvedMetadata {
  platform?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  author?: string;
  duration?: number;
  width?: number;
  height?: number;
  platform_id?: string;
}

export interface ResolveResponse {
  success: boolean;
  platform?: string;
  url?: string;
  metadata?: ResolvedMetadata;
  error?: string;
}

export interface MediaResolution {
  available: boolean;
  type?: string;
  download_url?: string;
  mime_type?: string;
  filename?: string;
  filesize?: number;
  duration?: number;
  width?: number;
  height?: number;
  video_codec?: string;
  audio_codec?: string;
  expires_at?: string;
  expires_in_seconds?: number;
  metadata?: {
    title?: string;
    description?: string;
    thumbnail?: string;
    uploader?: string;
    uploader_url?: string | null;
    platform_id?: string;
  };
}

export interface MediaResponse {
  success: boolean;
  platform?: string;
  url?: string;
  media?: MediaResolution;
  notice?: string;
  error?: string;
}

function classifyHttpStatus(status: number): MediaApiErrorKind {
  if (status === 429) return 'rate-limited';
  if (status === 400) return 'invalid-url';
  if (status === 404 || status === 410) return 'media-unavailable';
  return 'network';
}

function buildApiUrl(path: string, url: string): string {
  const endpoint = new URL(`${KIB_API_BASE}${path}`);
  endpoint.searchParams.set('url', url);
  return endpoint.toString();
}

/** Never log the submitted URL payload (privacy: it can contain private content ids). */
function stripUrl(text: string): string {
  return text.length > 8 ? `${text.slice(0, 8)}…` : text;
}

async function apiFetch(url: string, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if (signal?.aborted) throw e;
    const name = e instanceof Error ? e.name : '';
    throw name === 'AbortError' ? new MediaApiError('timeout', 'Media API request timed out') : new MediaApiError('network', 'Media API request failed');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

/** GET /api/v1/resolve — metadata only (title, creator, duration, resolution, platform id). */
export async function resolveApiMetadata(url: string, signal?: AbortSignal): Promise<ResolveResponse> {
  let response: Response;
  try {
    response = await apiFetch(buildApiUrl('/api/v1/resolve', url), 30_000, signal);
  } catch (e) {
    if (e instanceof MediaApiError) throw e;
    throw e; // network/timeout classification already applied
  }
  if (response.status === 404 || response.status === 400) {
    const body = await response.json().catch(() => null);
    throw new MediaApiError('unsupported-platform', body?.error ?? 'Metadata unavailable for this platform', response.status);
  }
  if (!response.ok) throw new MediaApiError(classifyHttpStatus(response.status), `Metadata request failed (${stripUrl(String(response.status))})`, response.status);
  const payload = await response.json() as ResolveResponse;
  if (payload.success !== true) {
    throw new MediaApiError('metadata-unavailable', payload.error ?? 'Metadata extraction failed');
  }
  return payload;
}

/**
 * GET /api/v1/media — processed video + temporary download URL.
 * Extraction runs remotely and can take minutes; use a long timeout.
 */
export async function resolveMedia(url: string, signal?: AbortSignal): Promise<MediaResolution> {
  let response: Response;
  try {
    response = await apiFetch(buildApiUrl('/api/v1/media', url), 270_000, signal);
  } catch (e) {
    if (signal?.aborted) throw e;
    if (e instanceof MediaApiError) throw e;
    throw new MediaApiError('network', 'Media request failed');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (body?.error && /unprocessable|unsupported|not supported/i.test(String(body.error))) {
      throw new MediaApiError('unsupported-platform', body.error, response.status);
    }
    throw new MediaApiError(classifyHttpStatus(response.status), body?.error ?? 'Media resolution failed', response.status);
  }
  const payload = await response.json() as MediaResponse;
  if (payload.success !== true || !payload.media || payload.media.available !== true) {
    throw new MediaApiError('media-unavailable', payload.error ?? 'Media is unavailable');
  }
  if (!payload.media.download_url) throw new MediaApiError('media-unavailable', 'No download URL was returned');
  return payload.media;
}
