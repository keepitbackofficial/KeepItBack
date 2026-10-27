import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { LocalDownload, SavedItem } from '../types';

export interface PendingOperation {
  id: string;
  user_id: string;
  op_type: 'save_url' | 'update_item' | 'delete_item';
  payload: Record<string, unknown>;
  retry_count: number;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database() {
  if (Platform.OS === 'web') throw new Error('Offline storage is available in the iOS and Android apps.');
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('keepitback-local.db');
      let key = await SecureStore.getItemAsync('keepitback.local.db.key');
      if (!key) {
        key = Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, '0')).join('');
        await SecureStore.setItemAsync('keepitback.local.db.key', key);
      }
      await db.execAsync(`PRAGMA key = '${key}'`);
      const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
      if (!cipher?.cipher_version) {
        throw new Error('Encrypted offline storage is unavailable. Install a KeepItBack development build to use offline features.');
      }
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cached_items (
          user_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, item_id)
        );
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          op_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sync_queue_user_created_idx ON sync_queue(user_id, created_at);
        CREATE TABLE IF NOT EXISTS local_downloads (
          user_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          local_uri TEXT NOT NULL,
          media_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          downloaded_at TEXT NOT NULL,
          PRIMARY KEY (user_id, item_id)
        );
        CREATE TABLE IF NOT EXISTS recent_searches (
          user_id TEXT NOT NULL,
          query TEXT NOT NULL,
          searched_at TEXT NOT NULL,
          PRIMARY KEY (user_id, query)
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function cacheItems(userId: string, items: SavedItem[]) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM cached_items WHERE user_id = ?', userId);
    for (const item of items) {
      await db.runAsync(
        'INSERT OR REPLACE INTO cached_items (user_id, item_id, payload, updated_at) VALUES (?, ?, ?, ?)',
        userId,
        item.id,
        JSON.stringify(item),
        new Date().toISOString(),
      );
    }
  });
}

export async function mergeCachedItems(userId: string, items: SavedItem[]) {
  const db = await database();
  for (const item of items) {
    await db.runAsync(
      'INSERT OR REPLACE INTO cached_items (user_id, item_id, payload, updated_at) VALUES (?, ?, ?, ?)',
      userId,
      item.id,
      JSON.stringify(item),
      new Date().toISOString(),
    );
  }
}

export async function getCachedItems(userId: string): Promise<SavedItem[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM cached_items WHERE user_id = ? ORDER BY updated_at DESC',
    userId,
  );
  return rows.map((row) => JSON.parse(row.payload) as SavedItem);
}

export async function enqueueOperation(userId: string, opType: PendingOperation['op_type'], payload: Record<string, unknown>) {
  const db = await database();
  const id = Crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO sync_queue (id, user_id, op_type, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    id,
    userId,
    opType,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
  return id;
}

export async function updateQueuedPayload(id: string, payload: Record<string, unknown>) {
  const db = await database();
  await db.runAsync('UPDATE sync_queue SET payload = ?, status = \'pending\', last_error = NULL WHERE id = ?', JSON.stringify(payload), id);
}

export async function pendingOperations(userId: string): Promise<PendingOperation[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ id: string; user_id: string; op_type: PendingOperation['op_type']; payload: string; retry_count: number }>(
    "SELECT id, user_id, op_type, payload, retry_count FROM sync_queue WHERE user_id = ? AND status IN ('pending', 'error') ORDER BY created_at",
    userId,
  );
  return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) as Record<string, unknown> }));
}

export async function recoverSyncingOperations(userId: string) {
  const db = await database();
  await db.runAsync("UPDATE sync_queue SET status = 'pending' WHERE user_id = ? AND status = 'syncing'", userId);
}

export async function getSyncQueueState(userId: string): Promise<'idle' | 'pending' | 'syncing' | 'retry'> {
  const db = await database();
  const rows = await db.getAllAsync<{ status: string }>('SELECT DISTINCT status FROM sync_queue WHERE user_id = ?', userId);
  const states = new Set(rows.map((row) => row.status));
  if (states.has('syncing')) return 'syncing';
  if (states.has('error')) return 'retry';
  return states.has('pending') ? 'pending' : 'idle';
}

export async function getPendingLocalItems(userId: string): Promise<SavedItem[]> {
  const operations = await pendingOperations(userId);
  return operations
    .filter((operation) => operation.op_type === 'save_url')
    .map((operation) => (operation.payload as { item?: SavedItem }).item)
    .filter((item): item is SavedItem => Boolean(item));
}

export async function updatePendingSave(userId: string, itemId: string, patch: Partial<SavedItem>) {
  const operations = await pendingOperations(userId);
  const operation = operations.find((op) => op.op_type === 'save_url' && (op.payload as { item?: SavedItem }).item?.id === itemId);
  if (!operation) return false;
  const payload = operation.payload as { item: SavedItem; [key: string]: unknown };
  const editedFields = new Set([...(payload.edited_fields as string[] | undefined ?? []), ...Object.keys(patch)]);
  await updateQueuedPayload(operation.id, { ...payload, item: { ...payload.item, ...patch, sync_state: 'pending' }, edited_fields: [...editedFields] });
  return true;
}

export async function queueItemUpdate(userId: string, item: SavedItem, patch: Record<string, unknown>) {
  if (item.id.startsWith('local:') && !item.remote_id) {
    const updated = await updatePendingSave(userId, item.id, patch as Partial<SavedItem>);
    if (updated) await updateCachedItem(userId, { ...item, ...patch, sync_state: 'pending' });
    return updated;
  }
  const pendingItem = { ...item, ...patch, sync_state: 'pending' as const };
  await updateCachedItem(userId, pendingItem);
  if (item.remote_id) await updateCachedItem(userId, { ...pendingItem, id: item.remote_id, remote_id: undefined });
  await enqueueOperation(userId, 'update_item', { canonical_url: item.canonical_url, patch });
  return true;
}

export async function deletePendingSave(userId: string, itemId: string) {
  const db = await database();
  const operations = await pendingOperations(userId);
  const operation = operations.find((op) => op.op_type === 'save_url' && (op.payload as { item?: SavedItem }).item?.id === itemId);
  if (operation) await db.runAsync('DELETE FROM sync_queue WHERE id = ?', operation.id);
  await db.runAsync('DELETE FROM cached_items WHERE user_id = ? AND item_id = ?', userId, itemId);
}

export async function queueItemDelete(userId: string, item: SavedItem) {
  await enqueueOperation(userId, 'delete_item', { canonical_url: item.canonical_url });
  const db = await database();
  await db.runAsync('DELETE FROM cached_items WHERE user_id = ? AND item_id = ?', userId, item.id);
}

export async function updateCachedItem(userId: string, item: SavedItem) {
  const db = await database();
  await db.runAsync(
    'INSERT OR REPLACE INTO cached_items (user_id, item_id, payload, updated_at) VALUES (?, ?, ?, ?)',
    userId,
    item.id,
    JSON.stringify(item),
    new Date().toISOString(),
  );
}

export async function removeCachedItem(userId: string, itemId: string) {
  const db = await database();
  await db.runAsync('DELETE FROM cached_items WHERE user_id = ? AND item_id = ?', userId, itemId);
}

export async function markOperation(id: string, status: 'pending' | 'syncing' | 'error', error?: string) {
  const db = await database();
  await db.runAsync(
    'UPDATE sync_queue SET status = ?, retry_count = retry_count + ?, last_error = ? WHERE id = ?',
    status,
    status === 'error' ? 1 : 0,
    error ?? null,
    id,
  );
}

export async function finishOperation(id: string) {
  const db = await database();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
}

export async function rememberSearch(userId: string, query: string) {
  const normalized = query.trim();
  if (!normalized) return;
  const db = await database();
  await db.runAsync(
    'INSERT OR REPLACE INTO recent_searches (user_id, query, searched_at) VALUES (?, ?, ?)',
    userId,
    normalized,
    new Date().toISOString(),
  );
  await db.runAsync(
    'DELETE FROM recent_searches WHERE user_id = ? AND query NOT IN (SELECT query FROM recent_searches WHERE user_id = ? ORDER BY searched_at DESC LIMIT 8)',
    userId,
    userId,
  );
}

export async function getRecentSearches(userId: string): Promise<string[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ query: string }>(
    'SELECT query FROM recent_searches WHERE user_id = ? ORDER BY searched_at DESC LIMIT 8',
    userId,
  );
  return rows.map((row) => row.query);
}

export async function storeDownload(download: LocalDownload) {
  const db = await database();
  await db.runAsync(
    'INSERT OR REPLACE INTO local_downloads (user_id, item_id, local_uri, media_type, file_size, downloaded_at) VALUES (?, ?, ?, ?, ?, ?)',
    download.user_id,
    download.item_id,
    download.local_uri,
    download.media_type,
    download.file_size,
    download.downloaded_at,
  );
}

export async function getDownloads(userId: string): Promise<LocalDownload[]> {
  const db = await database();
  return db.getAllAsync<LocalDownload>(
    'SELECT item_id, user_id, local_uri, media_type, file_size, downloaded_at FROM local_downloads WHERE user_id = ? ORDER BY downloaded_at DESC',
    userId,
  );
}

export async function removeDownload(userId: string, itemId: string) {
  const db = await database();
  await db.runAsync('DELETE FROM local_downloads WHERE user_id = ? AND item_id = ?', userId, itemId);
}

export async function remapDownload(userId: string, oldItemId: string, newItemId: string) {
  const rows = await getDownloads(userId);
  const existing = rows.find((row) => row.item_id === oldItemId);
  if (!existing) return;
  await removeDownload(userId, oldItemId);
  await storeDownload({ ...existing, item_id: newItemId });
}

export async function clearLocalUserData(userId: string) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM cached_items WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM sync_queue WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM recent_searches WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM local_downloads WHERE user_id = ?', userId);
  });
}
