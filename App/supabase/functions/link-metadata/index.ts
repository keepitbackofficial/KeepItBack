import { getAuthenticatedUser } from '../_shared/auth.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

type LinkMetadata = {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  creator_name?: string;
  creator_handle?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

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

function isInstagramHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am' || host.endsWith('.instagr.am');
}

function authorHandle(value: unknown): string | undefined {
  const url = safeHttpsUrl(value);
  if (!url) return undefined;
  const segment = new URL(url).pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '');
  if (segment && ['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'direct'].includes(segment.toLowerCase())) return undefined;
  if (!segment || !/^[a-zA-Z0-9._]{1,30}$/.test(segment)) return undefined;
  return `@${segment}`;
}

function handleFromTitle(value: unknown): string | undefined {
  const title = cleanText(value, 300);
  const match = title?.match(/\(@([a-zA-Z0-9._]{1,30})\)/);
  return match ? `@${match[1]}` : undefined;
}

function instagramCaption(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const quoted = description.match(/:\s*[“"]([\s\S]*?)[”"](?:[.!?])?\s*$/)?.[1];
  if (quoted) return cleanText(quoted, 300);

  const caption = description.replace(
    /^\s*[\d,.]+(?:\s*[KMB])?\s+likes?,\s*[\d,.]+(?:\s*[KMB])?\s+comments?\s*-\s*.+?\s+on\s+[^:]+:\s*/i,
    '',
  ).replace(/^[“"]/, '').replace(/[”"](?:[.!?])?$/, '').trim();
  return caption && caption !== description ? cleanText(caption, 300) : undefined;
}

function extractMetadata(payload: unknown): LinkMetadata | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  if (root.status !== 'success') return null;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : {};
  const image = data.image && typeof data.image === 'object' ? data.image as Record<string, unknown> : {};
  const thumbnail = safeHttpsUrl(image.url);
  const rawAuthor = cleanText(data.author, 160);
  const creatorName = rawAuthor?.toLowerCase() === 'instagram' ? undefined : rawAuthor;
  const rawTitle = cleanText(data.title, 300);
  const description = cleanText(data.description, 1000);
  const strippedTitle = rawTitle?.replace(/\s*[•|]\s*instagram\s+(?:reel|video|photo|post)$/i, '').trim();
  const titleWithoutHandle = strippedTitle?.replace(/\s*\(@[a-zA-Z0-9._]{1,30}\)$/, '').trim();
  const titleIsCreator = Boolean(titleWithoutHandle && creatorName && titleWithoutHandle.toLowerCase() === creatorName.toLowerCase());
  const title = instagramCaption(description)
    ?? (strippedTitle && strippedTitle.toLowerCase() !== 'instagram' && !titleIsCreator ? strippedTitle : undefined);

  const metadata: LinkMetadata = {
    title,
    description,
    thumbnail_url: thumbnail,
    creator_name: creatorName,
    creator_handle: authorHandle(data.author_url) ?? handleFromTitle(rawTitle),
  };
  return Object.values(metadata).some(Boolean) ? metadata : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return json({ code: 'unauthorized', error: 'Sign in to KeepItBack first.' }, 401);

  let body: { url?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Send a JSON request body.' }, 400); }
  if (typeof body.url !== 'string' || body.url.length > 2048) return json({ error: 'Enter a valid Instagram link.' }, 400);

  let target: URL;
  try { target = new URL(body.url); } catch { return json({ error: 'Enter a valid Instagram link.' }, 400); }
  if (target.protocol !== 'https:' || target.username || target.password || !isInstagramHost(target.hostname)) {
    return json({ error: 'Only public Instagram links can be previewed.' }, 400);
  }
  const standardMediaPath = /^\/(?:reel|reels|p|tv|share\/reel)\//i.test(target.pathname);
  const profileMediaPath = /^\/[a-zA-Z0-9._]+\/(?:reel|reels|p|tv)\//i.test(target.pathname);
  if (!standardMediaPath && !profileMediaPath) {
    return json({ metadata: null });
  }
  // Instagram share links commonly include per-share tracking query values.
  // They do not identify the Reel and would create unnecessary provider hits.
  target.search = '';
  target.hash = '';

  const endpoint = new URL('https://api.microlink.io');
  endpoint.searchParams.set('url', target.toString());
  endpoint.searchParams.set('filter', 'title,description,author,author_url,image.url');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return json({ metadata: null });
    const metadata = extractMetadata(await response.json());
    return json({ metadata });
  } catch {
    return json({ metadata: null });
  } finally {
    clearTimeout(timeout);
  }
});
