import { getSupabase, describeDbError, isSupabaseConfigured } from '../lib/supabase';
import { ConnectedAccount } from '../types';

/**
 * Connected accounts (Instagram DM linking). Reads go through Supabase RLS;
 * verification goes through the `link-code` Edge Function, which holds the
 * one-time code hashes server-side. The mobile client never reads code rows.
 */

export async function fetchConnectedAccounts(): Promise<{ data?: ConnectedAccount[]; error?: string }> {
  try {
    if (!isSupabaseConfigured) return { error: 'Supabase is not configured.' };
    const { data, error } = await getSupabase()
      .from('connected_accounts')
      .select()
      .eq('provider', 'instagram')
      .order('linked_at', { ascending: false });
    if (error) return { error: describeDbError(error) };
    return { data: (data ?? []) as ConnectedAccount[] };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export type VerifyCodeResult =
  | { ok: true; account: ConnectedAccount }
  | { notConfigured: true }
  | { error: string; rateLimited?: boolean; invalid?: boolean };

/** Verify a one-time IG DM code and link the sender to the signed-in user. */
export async function verifyLinkCode(code: string): Promise<VerifyCodeResult> {
  if (!isSupabaseConfigured) return { notConfigured: true };
  const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/link-code/verify`;

  let res: Response;
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { error: 'Sign in to KeepItBack first.' };
    res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: `${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    });
  } catch {
    return { error: 'Network error. Check your connection and try again.' };
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.status === 503 && body?.code === 'not_configured') {
    return { notConfigured: true };
  }
  if (res.status === 429) {
    return { error: body?.error ?? 'Too many attempts. Try again later.', rateLimited: true };
  }
  if (!res.ok) {
    if (body?.code === 'invalid_code') {
      return { error: body?.error ?? 'That code isn\u2019t valid or has expired.', invalid: true };
    }
    return { error: body?.error ?? `Verification failed (${res.status}).` };
  }
  const account = body?.account;
  if (!account?.provider_account_id) return { error: 'Unexpected response from server.' };
  return {
    ok: true,
    account: {
      id: account.id,
      user_id: account.user_id,
      provider: 'instagram',
      provider_account_id: account.provider_account_id,
      provider_username: account.provider_username ?? null,
      linked_at: account.linked_at ?? new Date().toISOString(),
    },
  };
}
