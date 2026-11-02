/**
 * Shared completion of Supabase auth redirects (deep links) for every flow:
 * the /auth/callback route (email links) and the Google OAuth browser
 * session. Guards against the same code being exchanged twice — the deep
 * link can reach both the route handler and the browser-session promise —
 * by treating "code already consumed but a session exists" as success.
 */
import { getSupabase } from './supabase';

export type AuthExchangeResult =
  | { ok: true; navigatedBy?: 'callback' }
  | { ok: false; error: string };

/** Read URL + fragment parameters a Supabase redirect may carry. */
export function getAuthParams(rawUrl: string) {
  const parsed = new URL(rawUrl);
  const params = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  hashParams.forEach((value, key) => params.set(key, value));
  return params;
}

/**
 * Pending navigation target for an in-flight OAuth sign-in (keeps a shared
 * URL alive across the Google round trip — V4 PRD §5 "do not lose the
 * shared URL during login"). One consumer wins: whoever clears it first
 * performs the navigation; the other skips.
 */
let pendingTarget: { shareUrl?: string } | null = null;

export function setPendingAuthTarget(shareUrl?: string) {
  pendingTarget = { shareUrl };
}

export function consumePendingAuthTarget(): { shareUrl?: string } | null {
  const target = pendingTarget;
  pendingTarget = null;
  return target;
}

export function pendingAuthTarget(): { shareUrl?: string } | null {
  return pendingTarget;
}

function navigateFor(target?: { shareUrl?: string } | null): { pathname: string; params?: Record<string, string> } {
  if (target?.shareUrl) return { pathname: '/save', params: { url: target.shareUrl, source: 'share_extension' } };
  return { pathname: '/(tabs)/home' };
}

/**
 * Complete sign-in from a redirect URL. Runs the PKCE code exchange, the
 * token-hash verification, or the fragment session fallback — the same
 * branches the callback route handles. Safe to call multiple times for
 * the same redirect.
 */
export async function completeAuthFromUrl(rawUrl: string): Promise<AuthExchangeResult> {
  if (!rawUrl) return { ok: false, error: 'Missing redirect URL.' };
  let params: URLSearchParams;
  try {
    params = getAuthParams(rawUrl);
  } catch {
    return { ok: false, error: 'Could not read the authentication redirect.' };
  }

  const providerError = params.get('error_description') || params.get('error');
  if (providerError) return { ok: false, error: providerError.replace(/\+/g, ' ') };

  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!code && !(tokenHash && type) && !(accessToken && refreshToken)) {
    return { ok: false, error: 'This authentication link is incomplete or expired. Request a new email.' };
  }

  const supabase = getSupabase();
  try {
    let failed: string | null = null;
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) failed = error.message;
    } else if (tokenHash && (type === 'signup' || type === 'email' || type === 'recovery' || type === 'magiclink')) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) failed = error.message;
    } else if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) failed = error.message;
    }

    if (failed) {
      // A concurrent duplicate handler may already have consumed the value.
      const { data } = await supabase.auth.getSession();
      if (!data.session) return { ok: false, error: failed };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not complete this authentication link.' };
  }
}

export { navigateFor };
