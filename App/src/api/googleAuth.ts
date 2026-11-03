/**
 * Google sign-in / sign-up through Supabase Auth (V4 PRD §2).
 *
 * Flow: signInWithOAuth(provider:'google', skipBrowserRedirect:true) →
 * openAuthSessionAsync in a system browser → redirect back to the
 * keepitback:// deep link → PKCE code exchange. The deep link also routes
 * to /auth/callback; both paths complete the same exchange, and the
 * helper below de-duplicates that (see authExchange.ts).
 */
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { completeAuthFromUrl, setPendingAuthTarget } from '../lib/authExchange';

export interface GoogleSignInOutcome {
  ok: boolean;
  /** User closed the browser before finishing — not an error worth a banner. */
  dismissed?: boolean;
  error?: string;
}

function friendlyError(message: string): string {
  if (/provider.{0,20}not enabled|unsupported provider|provider_not_enabled/i.test(message)) {
    return 'Google sign-in is not enabled for this project yet. A maintainer must turn the Google provider on in Supabase Auth settings.';
  }
  if (/redirect|callback/i.test(message)) {
    return 'Google sign-in has not been configured for this app yet. See Supabase Auth → URL Configuration.';
  }
  return message || 'Could not start Google sign-in. Try again.';
}

export async function signInWithGoogle(shareUrl?: string): Promise<GoogleSignInOutcome> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured. See .env.example and README to finish setup.' };
  }
  // A pending shared link rides along on the redirect URL itself (V4 PRD
  // §5), so it survives even if the app process restarts mid sign-in.
  const redirectTo = authRedirectUrl(shareUrl ? `/auth/callback?shareUrl=${encodeURIComponent(shareUrl)}` : '/auth/callback');
  setPendingAuthTarget(shareUrl);
  try {
    const { data, error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { ok: false, error: friendlyError(error.message) };
    if (!data?.url) return { ok: false, error: 'Google sign-in could not be started. Try again.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirectUrl('/auth/callback'));
    if (result.type === 'success' && typeof result.url === 'string') {
      // The deep link normally routes to /auth/callback which completes the
      // exchange. Fall back to completing it here when routing did not win.
      const completion = await completeAuthFromUrl(result.url);
      if (!completion.ok) return { ok: false, error: completion.error };
      return { ok: true };
    }
    if (result.type === 'locked') {
      return { ok: false, dismissed: true };
    }
    return { ok: false, dismissed: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e instanceof Error ? e.message : '') };
  } finally {
    // Let the callback route's success path drive navigation; clear only
    // when no session appeared (user backed out) to drop the stale target.
    const { data } = await getSupabase().auth.getSession().catch(() => ({ data: { session: null } }));
    if (!data.session) setPendingAuthTarget(shareUrl); // keep for the callback route handoff
  }
}

/**
 * The redirect that must land back inside the app after Google consent.
 *
 * Expo Go sessions round-trip the development server (`exp://<ip>:19000/--/…`),
 * which changes between sessions — there Linking.createURL is the only choice.
 * Everywhere else (dev client, testflight/production builds) the app.json
 * scheme is fixed, so we pin `keepitback://auth/callback` ourselves: the same
 * single URL in every session, which is also what the Supabase redirect
 * allow-list contains for production. That guarantees the browser lands back
 * in this app instead of falling back to the Supabase site URL.
 */
function authRedirectUrl(path: string): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return Linking.createURL(path);
  }
  // Deterministic deep link in every real build.
  const queryStart = path.indexOf('?');
  const query = queryStart >= 0 ? path.slice(queryStart) : '';
  return `keepitback://auth/callback${query}`;
}
