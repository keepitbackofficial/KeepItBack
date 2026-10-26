import { isSupabaseConfigured, getSupabase, describeDbError } from '../lib/supabase';
import { Collection, SavedItem } from '../types';

const ITEM_JOIN =
  '*, collection_items(item_id(*, item_tags(tag:tags(name))))';

function mapRow(r: any): Collection {
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    emoji: r.emoji,
    description: r.description,
    created_at: r.created_at,
    item_count: r.collection_items?.[0]?.count ?? 0,
  };
}

export async function fetchCollections(): Promise<{ data?: Collection[]; error?: string }> {
  try {
    if (!isSupabaseConfigured) return { error: 'Supabase is not configured.' };
    const db = getSupabase();
    const { data, error } = await db
      .from('collections')
      .select('*, collection_items(count)')
      .order('created_at', { ascending: false });
    if (error) return { error: describeDbError(error) };
    return { data: (data ?? []).map(mapRow) };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function fetchCollectionWithItems(id: string): Promise<{ data?: { collection: Collection; items: SavedItem[] }; error?: string }> {
  try {
    const db = getSupabase();
    const { data, error } = await db.from('collections').select(ITEM_JOIN).eq('id', id).maybeSingle();
    if (error) return { error: describeDbError(error) };
    if (!data) return { error: 'Collection not found.' };
    const items: SavedItem[] = ((data.collection_items as any[]) ?? [])
      .map((ci) => ci?.item_id)
      .filter((it) => !!it && !it.is_archived)
      .map((it: any) => ({
        id: it.id,
        user_id: it.user_id,
        original_url: it.original_url,
        canonical_url: it.canonical_url,
        platform: it.platform,
        content_type: it.content_type,
        title: it.title,
        creator_name: it.creator_name,
        creator_handle: it.creator_handle,
        source: it.source,
        note: it.note,
        saved_at: it.saved_at,
        opened_at: it.opened_at,
        open_count: it.open_count ?? 0,
        is_archived: it.is_archived ?? false,
        tags: (it.item_tags ?? [])
          .map((link: any) => link?.tag?.name ?? link?.tags?.name ?? link?.tag_id?.name)
          .filter(Boolean),
      }));
    const collection: Collection = {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      emoji: data.emoji,
      description: data.description,
      created_at: data.created_at,
      item_count: items.length,
    };
    return { data: { collection, items } };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function createCollection(input: {
  name: string;
  emoji: string;
  description?: string;
}): Promise<{ data?: Collection; error?: string; duplicate?: boolean }> {
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from('collections')
      .insert({ name: input.name, emoji: input.emoji, description: input.description ?? null })
      .select('*, collection_items(count)')
      .single();
    if (error) {
      if (error.code === '23505') return { duplicate: true };
      return { error: describeDbError(error) };
    }
    return { data: mapRow(data) };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function updateCollection(
  id: string,
  patch: { name?: string; emoji?: string; description?: string | null },
): Promise<{ error?: string }> {
  try {
    const db = getSupabase();
    const { error } = await db.from('collections').update(patch).eq('id', id);
    if (error) return { error: describeDbError(error) };
    return {};
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function deleteCollection(id: string): Promise<{ error?: string }> {
  try {
    const db = getSupabase();
    const { error } = await db.from('collections').delete().eq('id', id);
    if (error) return { error: describeDbError(error) };
    return {};
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}
