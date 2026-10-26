import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getAccessToken } from './clerkToken';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when the Supabase project URL + public anon key are configured. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** Error thrown when configuration is missing — surfaces an actionable state. */
export class NotConfiguredError extends Error {
  constructor(service: string) {
    super(`${service} is not configured. Add the required variables to .env (see .env.example).`);
    this.name = 'NotConfiguredError';
  }
}

let client: SupabaseClient | null = null;

/**
 * Real Supabase client using only public/anon credentials. Clerk's current
 * session JWT is attached through the v2 `accessToken` callback, so every
 * request carries a verified Clerk-issued token after third-party auth is
 * configured (README §Clerk ↔ Supabase). Never pass the service-role key
 * here — it must stay in server-side Edge Function secrets only.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new NotConfiguredError('Supabase');
  }
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        // Clerk is the identity provider; Supabase Auth itself is not used.
        persistSession: false,
        autoRefreshToken: false,
      },
      async accessToken() {
        return await getAccessToken();
      },
    });
  }
  return client;
}

/** Extract a helpful message from a PostgREST/PostgrestError. */
export function describeDbError(error: unknown): string {
  if (!isSupabaseConfigured) {
    return 'Supabase is not configured yet. See .env.example and README to finish setup.';
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const e = error as { message?: string; code?: string; details?: string };
    if (e.code === 'PGRST301' || e.code === '42501') {
      return 'Permission denied. Make sure the Supabase third-party auth (Clerk) integration is configured so requests carry your identity.';
    }
    return e.message || 'Request failed.';
  }
  return 'Request failed.';
}
