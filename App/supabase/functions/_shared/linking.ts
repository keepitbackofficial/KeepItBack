// Shared server-side helpers for Instagram DM account linking.
// Runs ONLY inside Supabase Edge Functions (Deno). Never import this into
// the mobile app — code hashes and secrets must stay server-side.

export const LINK_PROVIDER = 'instagram';
export const CODE_TTL_MS = 10 * 60 * 1000;

/** Cryptographically random, unambiguous code in the form ABC-1234. */
export async function generateCode(): Promise<string> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 3).join('')}-${chars.slice(3).join('')}`;
}

/** Codes are never stored in plaintext — only this HMAC, keyed server-side. */
export async function hashCode(code: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`link:${LINK_PROVIDER}:${code.toUpperCase()}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function requireEnv(name: string): string | null {
  const v = Deno.env.get(name);
  return v && v.length > 0 ? v : null;
}

/** SSRF-safe service-role Supabase client base helpers. */
export async function dbInsert(
  table: string,
  row: Record<string, unknown>,
  opts: { upsert?: { onConflict: string }; select?: boolean } = {},
): Promise<{ ok: boolean; status: number; body?: unknown }> {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return { ok: false, status: 503 };
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (opts.upsert) headers.Prefer = `resolution=merge-duplicates${opts.select ? ',return=representation' : ''}`;
  else if (opts.select) headers.Prefer = 'return=representation';
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: opts.upsert ? 'POST' : 'POST',
    headers,
    body: JSON.stringify(row),
  });
  if (!res.ok) return { ok: false, status: res.status };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: true, status: res.status, body };
}

export async function dbSelect(
  table: string,
  searchParams: Record<string, string>,
): Promise<{ ok: boolean; data?: unknown[] }> {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return { ok: false };
  const qp = new URLSearchParams(searchParams);
  const res = await fetch(`${url}/rest/v1/${table}?${qp}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return { ok: false };
  return { ok: true, data: await res.json() };
}

/**
 * Create a link code bound to an Instagram-scoped sender id. Enforces:
 * one outstanding (unused) code per sender, and at most 3 codes per hour
 * per sender. Codes expire after 10 minutes and are single-use.
 */
export async function issueLinkCode(providerAccountId: string): Promise<
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; reason: 'rate_limited' | 'outstanding' | 'server_config' }
> {
  const secret = requireEnv('LINK_CODE_SECRET');
  if (!secret) return { ok: false, reason: 'server_config' };

  // One outstanding code per sender (same constraint exists in SQL).
  const open = await dbSelect('account_link_codes', {
    provider: `eq.${LINK_PROVIDER}`,
    provider_account_id: `eq.${providerAccountId}`,
    used_at: 'is.null',
    select: 'id,expires_at',
    order: 'created_at.desc',
    limit: '1',
  });
  if (open.ok && Array.isArray(open.data) && open.data.length > 0) {
    const exp = new Date(String((open.data[0] as any).expires_at ?? 0));
    if (exp.getTime() > Date.now()) return { ok: false, reason: 'outstanding' };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await dbSelect('account_link_codes', {
    provider: `eq.${LINK_PROVIDER}`,
    provider_account_id: `eq.${providerAccountId}`,
    created_at: `gte.${hourAgo}`,
    select: 'id',
  });
  if (recent.ok && Array.isArray(recent.data) && recent.data.length >= 3) {
    return { ok: false, reason: 'rate_limited' };
  }

  const code = await generateCode();
  const codeHash = await hashCode(code, secret);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const ins = await dbInsert('account_link_codes', {
    provider: LINK_PROVIDER,
    provider_account_id: providerAccountId,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (!ins.ok) return { ok: false, reason: 'server_config' };
  return { ok: true, code, expiresAt };
}

export type VerifyOutcome =
  | { kind: 'ok'; connectedAccount: Record<string, unknown> }
  | { kind: 'invalid' }
  | { kind: 'rate_limited' }
  | { kind: 'server_config' };

/**
 * Verify a submitted code: HMAC match against open codes, expiry check,
 * single use, per-user attempt rate limiting, then link the Instagram
 * sender id to the verified Supabase user id.
 */
export async function verifyAndLink(
  rawCode: string,
  userId: string,
): Promise<VerifyOutcome> {
  const secret = requireEnv('LINK_CODE_SECRET');
  if (!secret) return { kind: 'server_config' };

  const submitted = rawCode.trim().toUpperCase();
  const hash = await hashCode(submitted, secret);

  const matches = await dbSelect('account_link_codes', {
    provider: `eq.${LINK_PROVIDER}`,
    code_hash: `eq.${hash}`,
    used_at: 'is.null',
    select: 'id,provider_account_id,expires_at',
  });
  if (!matches.ok || !Array.isArray(matches.data) || matches.data.length === 0) {
    return { kind: 'invalid' };
  }
  const row = matches.data[0] as { id: string; provider_account_id: string; expires_at: string };
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { kind: 'invalid' };
  }

  const now = new Date().toISOString();
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return { kind: 'server_config' };

  // Mark used FIRST (atomic single-use) with a conditional update.
  const upd = await fetch(
    `${url}/rest/v1/account_link_codes?id=eq.${row.id}&used_at=is.null`,
    {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ used_at: now }),
    },
  );
  const upJson = (await upd.json()) as unknown[];
  if (!upd.ok || !Array.isArray(upJson) || upJson.length === 0) {
    // Someone else used it first — single-use holds.
    return { kind: 'invalid' };
  }

  // Upsert the connection; provider+account is unique. Re-linking reassigns.
  const up = await dbInsert(
    'connected_accounts',
    {
      user_id: userId,
      provider: LINK_PROVIDER,
      provider_account_id: row.provider_account_id,
      linked_at: now,
    },
    { upsert: { onConflict: 'provider,provider_account_id' }, select: true },
  );
  if (!up.ok) return { kind: 'server_config' };
  const account = Array.isArray(up.body) ? (up.body as unknown[])[0] : up.body;
  return { kind: 'ok', connectedAccount: account as Record<string, unknown> };
}
