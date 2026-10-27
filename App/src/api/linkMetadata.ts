import { isValidUrl } from '../lib/platform';
import { getSupabase } from '../lib/supabase';

export interface LinkMetadata {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  creator_name?: string;
  creator_handle?: string;
}

interface OEmbedResponse {
  title?: unknown;
  author_name?: unknown;
  author_url?: unknown;
  thumbnail_url?: unknown;
  description?: unknown;
}

function isInstagramHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am' || host.endsWith('.instagr.am');
}

const cache = new Map<string, { expiresAt: number; value: LinkMetadata | null }>();
const inFlight = new Map<string, Promise<LinkMetadata | null>>();
const CACHE_MS = 5 * 60 * 1000;
const EMPTY_CACHE_MS = 15 * 1000;

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function oEmbedEndpoint(contentUrl: URL): string | null {
  const host = contentUrl.hostname.toLowerCase();
  const youtube = host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
  if (youtube) {
    const endpoint = new URL('https://www.youtube.com/oembed');
    endpoint.searchParams.set('url', contentUrl.toString());
    endpoint.searchParams.set('format', 'json');
    return endpoint.toString();
  }

  const tiktok = host === 'tiktok.com' || host.endsWith('.tiktok.com');
  if (tiktok) {
    const endpoint = new URL('https://www.tiktok.com/oembed');
    endpoint.searchParams.set('url', contentUrl.toString());
    return endpoint.toString();
  }
  return null;
}

function handleFromAuthorUrl(value: unknown): string | undefined {
  const authorUrl = safeHttpsUrl(value);
  if (!authorUrl) return undefined;
  try {
    const firstSegment = new URL(authorUrl).pathname.split('/').filter(Boolean)[0];
    return firstSegment?.startsWith('@') ? cleanText(firstSegment, 80) : undefined;
  } catch {
    return undefined;
  }
}

async function requestMetadata(url: string): Promise<LinkMetadata | null> {
  let contentUrl: URL;
  try {
    contentUrl = new URL(url);
  } catch {
    return null;
  }
  if (isInstagramHost(contentUrl.hostname)) {
    try {
      const { data, error } = await getSupabase().functions.invoke('link-metadata', { body: { url } });
      if (error) return null;
      const metadata = data?.metadata as Record<string, unknown> | null | undefined;
      if (!metadata) return null;
      const safeMetadata: LinkMetadata = {
        title: cleanText(metadata.title, 300),
        description: cleanText(metadata.description, 1000),
        thumbnail_url: safeHttpsUrl(metadata.thumbnail_url),
        creator_name: cleanText(metadata.creator_name, 160),
        creator_handle: cleanText(metadata.creator_handle, 80),
      };
      return Object.values(safeMetadata).some(Boolean) ? safeMetadata : null;
    } catch {
      return null;
    }
  }

  const endpoint = oEmbedEndpoint(contentUrl);
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json() as OEmbedResponse;
    const metadata: LinkMetadata = {
      title: cleanText(payload.title, 300),
      description: cleanText(payload.description, 1000),
      thumbnail_url: safeHttpsUrl(payload.thumbnail_url),
      creator_name: cleanText(payload.author_name, 160),
      creator_handle: handleFromAuthorUrl(payload.author_url),
    };
    return Object.values(metadata).some(Boolean) ? metadata : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch only metadata exposed by the provider's documented oEmbed endpoint. */
export function fetchLinkMetadata(rawUrl: string, options: { force?: boolean } = {}): Promise<LinkMetadata | null> {
  const url = rawUrl.trim();
  if (!isValidUrl(url)) return Promise.resolve(null);
  if (!options.force) {
    const cached = cache.get(url);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
    const active = inFlight.get(url);
    if (active) return active;
  } else {
    cache.delete(url);
  }

  let request: Promise<LinkMetadata | null>;
  request = requestMetadata(url).then((value) => {
    if (inFlight.get(url) === request) {
      cache.set(url, { value, expiresAt: Date.now() + (value ? CACHE_MS : EMPTY_CACHE_MS) });
    }
    return value;
  }).finally(() => {
    if (inFlight.get(url) === request) inFlight.delete(url);
  });
  inFlight.set(url, request);
  return request;
}
