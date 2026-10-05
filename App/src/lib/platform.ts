import { ContentType, Platform } from '../types';

/**
 * Platform + content-type detection from a URL.
 * PRD §9 — unknown URLs fall back to Other/Web.
 */
export function detectPlatform(url: string): Platform {
  const u = url.toLowerCase();
  if (/instagram\.com/.test(u)) return 'Instagram';
  if (/youtube\.com|youtu\.be/.test(u)) return 'YouTube';
  if (/tiktok\.com/.test(u)) return 'TikTok';
  if (/facebook\.com|fb\.watch/.test(u)) return 'Facebook';
  if (/(twitter|x)\.com/.test(u)) return 'X';
  if (/pinterest\./.test(u)) return 'Pinterest';
  if (/reddit\.com/.test(u)) return 'Reddit';
  return 'Other';
}

export function detectContentType(url: string): ContentType {
  const u = url.toLowerCase();
  if (/\/reel\//.test(u)) return 'Reel';
  if (/\/shorts\//.test(u)) return 'Short';
  if (/youtu\.be|\/watch|\/video|\/videos|fb\.watch|\/tv\//.test(u)) return 'Video';
  if (/\/explore\//.test(u)) return 'Reel';
  if (/\.(jpe?g|png|gif|webp)(\?|$)/.test(u)) return 'Image';
  if (/\/p\//.test(u)) return 'Post';
  if (/\/article|\/blog|\/posts?\//.test(u)) return 'Article';
  if (/\.(pdf|md|txt)(\?|$)/.test(u)) return 'Article';
  return 'Link';
}

export const platformEmoji: Record<Platform, string> = {
  Instagram: '📸',
  YouTube: '▶️',
  TikTok: '🎵',
  Facebook: '👥',
  X: '𝕏',
  Pinterest: '📌',
  Reddit: '👽',
  Other: '🌐',
};

export const platformColor: Record<Platform, string> = {
  Instagram: '#E1306C',
  YouTube: '#FF4444',
  TikTok: '#00C2CB',
  Facebook: '#4E8CFF',
  X: '#AAAAAA',
  Pinterest: '#E60023',
  Reddit: '#FF6634',
  Other: '#7C5CFC',
};

export function isValidUrl(text: string): boolean {
  const t = text.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(t);
    return true;
  } catch {
    return false;
  }
}

/** Simple canonicalization: strip tracking params + trailing slash. */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const junk = ['utm_source', 'utm_medium', 'utm_campaign', 'igsh', 'igshid', 'si', 'feature', 'app'];
    junk.forEach((p) => u.searchParams.delete(p));
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim();
  }
}
