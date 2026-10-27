import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
 * Supabase Auth is the identity provider and Supabase is also the data store.
 * This client only uses the public anon/publishable key; service-role keys
 * must stay in server-side Edge Function secrets only.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new NotConfiguredError('Supabase');
  }
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
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
      return 'Permission denied. Check that you are signed in and that the Supabase row-level security policies are installed.';
    }
    return e.message || 'Request failed.';
  }
  return 'Request failed.';
}
