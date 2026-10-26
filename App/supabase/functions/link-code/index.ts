// Supabase Edge Function — link-code
//
// POST /functions/v1/link-code/verify
//   Body: { code }
//   Auth: Authorization: Bearer <Clerk-issued JWT> (verified against Clerk
//   JWKS below; the mobile app sends its current Clerk session token).
//   Verifies the one-time code issued to the user's Instagram DM sender
//   id and links that sender to the Clerk user id (sub).
//
// Secrets (set with: supabase secrets set NAME=value):
//   LINK_CODE_SECRET  — HMAC key for one-time codes (required)
//   CLERK_JWKS_URL    — e.g. https://<app>.clerk.accounts.dev/.well-known/jwks.json
//
// Missing configuration returns 503 {code:'not_configured'} — the app
// shows an honest "Not configured" state, never a fake success.

import { verifyAndLink } from '../_shared/linking.ts';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(Deno.env.get('CLERK_JWKS_URL') ?? ''));
  }
  return jwks;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (Deno.env.get('LINK_CODE_SECRET') === null || !Deno.env.get('CLERK_JWKS_URL')) {
    return json({ code: 'not_configured' }, 503);
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Verify the Clerk JWT from the app.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return json({ code: 'unauthorized', error: 'Sign in to KeepItBack first.' }, 401);

  let clerkUserId: string;
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      algorithms: ['RS256', 'EdDSA'],
    });
    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') throw new Error('no sub');
    clerkUserId = sub;
  } catch {
    return json({ code: 'unauthorized', error: 'Your session token is invalid or expired. Sign in again.' }, 401);
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ code: 'bad_request', error: 'Send the code as JSON {code}.' }, 400);
  }

  const code = (body.code ?? '').trim();
  if (!/^[-A-Z4-9]{7,9}$/i.test(code)) {
    return json({ code: 'invalid_code', error: 'That code format doesn\u2019t look right — check the message from Instagram.' }, 400);
  }

  const res = await verifyAndLink(code, clerkUserId);
  switch (res.kind) {
    case 'ok':
      return json({ ok: true, account: res.connectedAccount });
    case 'invalid':
      return json({ code: 'invalid_code', error: 'That code isn\u2019t valid or has expired. Request a new one by messaging KeepItBack on Instagram.' }, 400);
    case 'server_config':
      return json({ code: 'not_configured' }, 503);
    case 'rate_limited':
    default:
      return json({ code: 'rate_limited', error: 'Too many attempts right now. Try again in a little while.' }, 429);
  }
});
