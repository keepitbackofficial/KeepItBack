import { getSupabase } from '../lib/supabase';
import { Profile, SavedItem } from '../types';

/**
 * Profile API — identity comes from Clerk. Row user_id must equal the
 * verified JWT `sub` (Clerk user id, text); RLS enforces the same.
 */

export interface ClerkInfo {
  userId: string;
  name?: string;
  email?: string;
}

/** Idempotently create/update the application profile after real auth. */
export async function upsertProfile(info: ClerkInfo): Promise<{ data?: Profile; error?: string }> {
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from('profiles')
      .upsert(
        {
          user_id: info.userId,
          display_name: info.name ?? null,
          email: info.email ?? null,
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();
    if (error) return { error: error.message };
    return { data: data as Profile };
  } catch (e: any) {
    return { error: e?.message ?? 'Failed to sync profile' };
  }
}

export async function fetchProfile(userId: string): Promise<{ data?: Profile; error?: string }> {
  try {
    const db = getSupabase();
    const { data, error } = await db.from('profiles').select().eq('user_id', userId).maybeSingle();
    if (error) return { error: error.message };
    return { data: (data as Profile) ?? undefined };
  } catch (e: any) {
    return { error: e?.message ?? 'Failed to load profile' };
  }
}

export async function updateDisplayName(userId: string, displayName: string): Promise<{ error?: string }> {
  try {
    const db = getSupabase();
    const { error } = await db
      .from('profiles')
      .update({ display_name: displayName })
      .eq('user_id', userId);
    if (error) return { error: error.message };
    return {};
  } catch (e: any) {
    return { error: e?.message ?? 'Failed to update profile' };
  }
}

/** Shared mapper: hydrate joined tags onto the item. */
export function mapItem(r: any): SavedItem {
  return {
    id: r.id,
    user_id: r.user_id,
    original_url: r.original_url,
    canonical_url: r.canonical_url,
    platform: r.platform,
    content_type: r.content_type,
    title: r.title,
    creator_name: r.creator_name,
    creator_handle: r.creator_handle,
    source: r.source,
    note: r.note,
    saved_at: r.saved_at,
    opened_at: r.opened_at,
    open_count: r.open_count ?? 0,
    is_archived: r.is_archived ?? false,
    tags: (r.item_tags ?? r.tag_links ?? [])
      .map((link: any) => link?.tag?.name ?? link?.tags?.name ?? link?.tag_id?.name)
      .filter(Boolean),
  };
}

// (unused import guard removed)
