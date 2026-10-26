// Supabase Edge Function — instagram-webhook
//
// Handles Meta Instagram Messaging webhooks for the official KeepItBack
// professional account:
//   GET  — Meta subscription handshake (hub.verify_token / hub.challenge)
//   POST — signature-verified ingestion; dedup via webhook_events; when a
//          linked user sends a supported link, it is saved to their library.
//
// Secrets:
//   META_APP_SECRET       — App secret for X-Hub-Signature-256 (required)
//   META_VERIFY_TOKEN     — token chosen by you for the GET handshake (required)
//   META_TOKEN / META_IG_USER_ID — optional: enables "Saved!"/"Link first"
//                            replies to the sender (a real Messaging send)
//
// Unconfigured POSTs are rejected (401/503) — Meta webhooks fail closed
// and the app never fakes ingestion.

import { dbInsert, dbSelect, timingSafeEqual, requireEnv } from '../_shared/linking.ts';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } as const;

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return 'Instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube';
  if (u.includes('tiktok.com')) return 'TikTok';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'Facebook';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'X';
  if (u.includes('pinterest.')) return 'Pinterest';
  if (u.includes('reddit.com')) return 'Reddit';
  return 'Web';
}

function detectContentType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('/reel/') || u.includes('/explore/')) return 'Reel';
  if (u.includes('/shorts/')) return 'Short';
  if (u.includes('youtu.be') || u.includes('/watch') || u.includes('/video')) return 'Video';
  if (u.includes('/p/')) return 'Post';
  if (/\.(jpe?g|png|gif|webp)(\?|$)/.test(u)) return 'Image';
  if (u.includes('/article') || u.includes('/blog')) return 'Article';
  return 'Link';
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    const junk = ['utm_source', 'utm_medium', 'utm_campaign', 'igsh', 'igshid', 'si', 'feature', 'app'];
    junk.forEach((p) => u.searchParams.delete(p));
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function hmacHex(data: ArrayBuffer, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, data);
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendIgMessage(igUserId: string, recipientId: string, text: string): Promise<void> {
  const token = requireEnv('META_TOKEN');
  if (!token) return;
  try {
    await fetch(`https://graph.facebook.com/v21.0/${igUserId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: 'RESPONSE',
      }),
    });
  } catch {
    // Replies are best-effort; saving already happened (or didn't) above.
  }
}

Deno.serve(async (req: Request) => {
  const method = req.method;

  // --- Meta subscription handshake ----------------------------------------
  if (method === 'GET') {
    const verifyToken = requireEnv('META_VERIFY_TOKEN');
    const mode = new URL(req.url).searchParams.get('hub.mode');
    const token = new URL(req.url).searchParams.get('hub.verify_token');
    const challenge = new URL(req.url).searchParams.get('hub.challenge');
    if (!verifyToken) return json({ code: 'not_configured' }, 503);
    if (mode === 'subscribe' && token && challenge && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const appSecret = requireEnv('META_APP_SECRET');
  if (!appSecret) return json({ code: 'not_configured' }, 503);

  // --- Signature verification (fail closed) --------------------------------
  const raw = await req.arrayBuffer();
  const sigHeader = req.headers.get('X-Hub-Signature-256') ?? '';
  const expected = 'sha256=' + (await hmacHex(raw, appSecret));
  if (!sigHeader || !timingSafeEqual(sigHeader, expected)) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const igUserId = requireEnv('META_IG_USER_ID') ?? payload?.entry?.[0]?.id;

  for (const entry of payload?.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const eventId = event?.message?.mid;
      const senderId = event?.sender?.id;
      const text: string = event?.message?.text ?? '';

      // Idempotency: skip already-processed Meta message ids.
      if (eventId) {
        const seen = await dbInsert('webhook_events', { event_id: eventId, payload });
        if (!seen.ok && seen.status === 409) continue;
      }
      if (!senderId) continue;

      // Find the linked KeepItBack user for this Instagram sender id.
      const link = await dbSelect('connected_accounts', {
        provider: 'eq.instagram',
        provider_account_id: `eq.${senderId}`,
        select: 'user_id',
        limit: '1',
      });
      const userId = link.ok && Array.isArray(link.data) && link.data.length
        ? String((link.data[0] as any).user_id)
        : null;

      const urlMatch = text.match(URL_RE);

      if (!userId) {
        await sendIgMessage(igUserId, senderId, 'Hi! To link this chat to your KeepItBack account, open the app → Profile → Connected accounts → enter the one-time code KeepItBack sent you. Code flow is enabled once the integration is configured.');
        continue;
      }

      if (!urlMatch) continue; // not a link — nothing to save

      const originalUrl = urlMatch[0];
      const platform = detectPlatform(originalUrl);
      const insert = await dbInsert('saved_items', {
        user_id: userId,
        original_url: originalUrl,
        canonical_url: canonicalUrl(originalUrl),
        platform,
        content_type: detectContentType(originalUrl),
        title: `Instagram DM ${platform === 'Web' ? 'link' : platform}`,
        source: 'instagram_dm',
      });

      if (insert.ok && insert.status !== 409) {
        await sendIgMessage(igUserId, senderId, 'Saved. It\u2019s in your KeepItBack library and searchable now.');
      } else if (insert.ok) {
        await sendIgMessage(igUserId, senderId, 'That link was already in your library — nothing new to add.');
      }
      // On unknown insert errors we do NOT confirm to the user.
    }
  }

  // Meta expects a fast 200 regardless of internal handling outcomes.
  return json({ ok: true });
});
