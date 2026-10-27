import { getSupabase } from '../lib/supabase';
import { NotificationPreferences, Profile, SavedItem } from '../types';

/**
 * Profile API — row user_id must equal the authenticated Supabase JWT `sub`;
 * RLS enforces the same.
 */

export interface ProfileIdentity {
  userId: string;
  name?: string;
  email?: string;
}

/** Idempotently create/update the application profile after real auth. */
export async function upsertProfile(info: ProfileIdentity): Promise<{ data?: Profile; error?: string }> {
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

export async function updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<{ error?: string }> {
  try {
    const { error } = await getSupabase().from('profiles').update({ notification_preferences: preferences }).eq('user_id', userId);
    return error ? { error: error.message } : {};
  } catch (e: any) {
    return { error: e?.message ?? 'Could not save notification preferences.' };
  }
}

export async function updateAnalyticsPreference(userId: string, enabled: boolean): Promise<{ error?: string }> {
  try {
    const { error } = await getSupabase().from('profiles').update({ analytics_opt_in: enabled }).eq('user_id', userId);
    return error ? { error: error.message } : {};
  } catch (e: any) {
    return { error: e?.message ?? 'Could not save analytics preference.' };
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
    description: r.description ?? null,
    thumbnail_url: r.thumbnail_url ?? null,
    category: r.category ?? null,
    sync_state: r.sync_state ?? 'synced',
    tags: (r.item_tags ?? r.tag_links ?? [])
      .map((link: any) => link?.tag?.name ?? link?.tags?.name ?? link?.tag_id?.name)
      .filter(Boolean),
  };
}

// (unused import guard removed)
