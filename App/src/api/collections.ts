import { isSupabaseConfigured, getSupabase, describeDbError } from '../lib/supabase';
import { Collection, SavedItem } from '../types';
import { getActiveUserId } from '../lib/authState';

function mapRow(r: any): Collection {
  return {
    id: r.id,
    user_id: getActiveUserId() ?? '',
    name: r.name,
    emoji: r.emoji,
    description: r.description,
    created_at: r.created_at,
    item_count: r.collection_items?.[0]?.count ?? 0,
    role: r.role,
    is_shared: Boolean(r.is_shared),
  };
}

export async function fetchCollections(): Promise<{ data?: Collection[]; error?: string }> {
  try {
    if (!isSupabaseConfigured) return { error: 'Supabase is not configured.' };
    const db = getSupabase();
    const { data, error } = await db
      .from('collections')
      .select('id,name,emoji,description,is_shared,created_at,collection_items(count)')
      .order('created_at', { ascending: false });
    if (error) return { error: describeDbError(error) };
    const ids = (data ?? []).map((row: any) => row.id);
    let memberships: any[] = [];
    if (ids.length) {
      const membershipResult = await db.from('collection_members').select('collection_id,role').in('collection_id', ids);
      if (membershipResult.error && (data ?? []).some((row: any) => row.is_shared)) return { error: describeDbError(membershipResult.error) };
      memberships = membershipResult.data ?? [];
    }
    const byId = new Map(memberships.map((membership) => [membership.collection_id, membership.role]));
    return { data: (data ?? []).map((row: any) => ({ ...mapRow(row), role: byId.get(row.id) ?? 'owner' })) };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function fetchCollectionWithItems(id: string): Promise<{ data?: { collection: Collection; items: SavedItem[] }; error?: string }> {
  try {
    const db = getSupabase();
    const { data, error } = await db.from('collections').select('id,name,emoji,description,is_shared,created_at,collection_items(count)').eq('id', id).maybeSingle();
    if (error) return { error: describeDbError(error) };
    if (!data) return { error: 'Collection not found.' };
    const { data: membership, error: membershipError } = await db.from('collection_members').select('role').eq('collection_id', id).maybeSingle();
    if (data.is_shared && (membershipError || !membership)) return { error: membershipError ? describeDbError(membershipError) : 'You are not a member of this shared collection.' };
    let items: SavedItem[] = [];
    if (data.is_shared) {
      const { data: shared, error: sharedError } = await db.rpc('get_shared_collection_items', { p_collection_id: id });
      if (sharedError) return { error: describeDbError(sharedError) };
      items = ((shared ?? []) as any[]).map((row) => ({
        ...row,
        user_id: '',
        opened_at: null,
        note: null,
        tags: [],
        is_archived: Boolean(row.is_archived),
        sync_state: 'synced' as const,
      }));
    } else {
      if (membership?.role !== 'owner') return { error: 'Collection not found.' };
      const { data: owned, error: itemsError } = await db.from('collection_items')
        .select('item_id(*, item_tags(tag:tags(name)))')
        .eq('collection_id', id);
      if (itemsError) return { error: describeDbError(itemsError) };
      items = ((owned ?? []) as any[]).map((entry) => entry.item_id).filter((item) => item && !item.is_archived).map((item) => ({
        ...item,
        tags: (item.item_tags ?? []).map((link: any) => link?.tag?.name ?? link?.tags?.name).filter(Boolean),
      }));
    }
    const collection: Collection = {
      id: data.id,
      user_id: getActiveUserId() ?? '',
      name: data.name,
      emoji: data.emoji,
      description: data.description,
      created_at: data.created_at,
      item_count: items.length,
      role: membership?.role ?? 'owner',
      is_shared: Boolean(data.is_shared),
    };
    return { data: { collection, items } };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function createCollectionInvite(collectionId: string, role: 'editor' | 'viewer') {
  try {
    const { data, error } = await getSupabase().functions.invoke('collection-invites', {
      body: { action: 'create', collectionId, role },
    });
    if (error) return { error: describeDbError(error) };
    return { data: data as { code: string; inviteId: string; expiresAt: string } };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function acceptCollectionInvite(code: string) {
  try {
    const { data, error } = await getSupabase().functions.invoke('collection-invites', {
      body: { action: 'accept', code },
    });
    if (error) return { error: describeDbError(error) };
    if (!data?.ok || !data.collectionId) return { error: data?.error ?? 'This invitation could not be accepted.' };
    return { data: data as { ok: true; collectionId: string; role?: 'editor' | 'viewer'; alreadyMember?: boolean } };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function removeCollectionItem(collectionId: string, itemId: string) {
  try {
    const { error } = await getSupabase().from('collection_items').delete()
      .eq('collection_id', collectionId).eq('item_id', itemId);
    return error ? { error: describeDbError(error) } : {};
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function addCollectionItem(collectionId: string, itemId: string) {
  try {
    const { error } = await getSupabase().from('collection_items').insert({ collection_id: collectionId, item_id: itemId });
    if (error?.code === '23505') return {};
    return error ? { error: describeDbError(error) } : {};
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
