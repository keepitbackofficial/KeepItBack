import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getSupabase, describeDbError } from '../lib/supabase';
import { getDownloads, pendingOperations } from '../lib/localStore';

export async function exportAccountData(userId: string) {
  try {
    const db = getSupabase();
    const [profile, items, tags, collections, collectionItems, accounts, memberships, categories] = await Promise.all([
      db.from('profiles').select().maybeSingle(),
      db.from('saved_items').select('*, item_tags(tag:tags(name))').order('saved_at', { ascending: false }),
      db.from('tags').select('id,name,created_at').order('name'),
      db.from('collections').select('id,name,emoji,description,is_shared,created_at').order('created_at', { ascending: false }),
      db.from('collection_items').select('collection_id,item_id,added_at'),
      db.from('connected_accounts').select('provider,provider_account_id,provider_username,linked_at'),
      db.from('collection_members').select('collection_id,role,joined_at'),
      db.from('categories').select('name,created_at').order('name'),
    ]);
    const failed = [profile, items, tags, collections, collectionItems, accounts, memberships, categories].find((result) => result.error);
    if (failed?.error) return { error: describeDbError(failed.error) };
    let localState: { deviceDownloads: unknown[]; pendingOfflineChanges: unknown[]; localStateAvailable: boolean };
    try {
      const [downloads, pending] = await Promise.all([getDownloads(userId), pendingOperations(userId)]);
      localState = {
        deviceDownloads: downloads.map(({ item_id, media_type, file_size, downloaded_at }) => ({ item_id, media_type, file_size, downloaded_at })),
        pendingOfflineChanges: pending.map(({ op_type, payload, retry_count }) => ({ op_type, payload, retry_count })),
        localStateAvailable: true,
      };
    } catch {
      localState = { deviceDownloads: [], pendingOfflineChanges: [], localStateAvailable: false };
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      profile: profile.data,
      savedItems: items.data,
      tags: tags.data,
      collections: collections.data,
      collectionItems: collectionItems.data,
      connectedAccounts: accounts.data,
      collectionMemberships: memberships.data,
      categories: categories.data,
      ...localState,
    };
    const file = new File(Paths.cache, `KeepItBack-export-${new Date().toISOString().slice(0, 10)}.json`);
    await file.write(JSON.stringify(payload, null, 2));
    if (!(await Sharing.isAvailableAsync())) {
      file.delete();
      return { error: 'The share sheet is not available on this device.' };
    }
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export KeepItBack data' });
    file.delete();
    return { data: true };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}

export async function deleteCloudAccount() {
  try {
    const { data, error } = await getSupabase().functions.invoke('account-privacy', { body: { action: 'delete_account' } });
    if (error) return { error: describeDbError(error) };
    return data?.ok ? {} : { error: data?.error ?? 'Account deletion did not complete.' };
  } catch (e: any) {
    return { error: describeDbError(e) };
  }
}
