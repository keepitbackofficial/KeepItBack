import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import { fetchItem } from '../../src/api/items';
import { logProductEvent } from '../../src/api/analytics';
import { deleteDownloadedMedia, listDownloads } from '../../src/lib/downloads';
import { getCachedItems, getPendingLocalItems } from '../../src/lib/localStore';
import { KIBButton, KIBEmptyState } from '../../src/components/KIBPrimitives';
import { SavedItem } from '../../src/types';
import { colors, spacing, type } from '../../src/theme';
import { safeBack } from '../../src/lib/navigation';

type DownloadRow = { itemId: string; uri: string; size: number; title: string; item?: SavedItem };

async function loadDownloadRows(userId: string): Promise<DownloadRow[]> {
  const records = await listDownloads(userId);
  let cached: SavedItem[] = [];
  try {
    const [saved, pending] = await Promise.all([getCachedItems(userId), getPendingLocalItems(userId)]);
    cached = [...pending, ...saved];
  } catch { /* Remote metadata can still be fetched. */ }
  return Promise.all(records.map(async (record) => {
    let item = cached.find((saved) => saved.id === record.item_id);
    if (!item) {
      const result = await fetchItem(record.item_id);
      if ('data' in result) item = result.data;
    }
    return { itemId: record.item_id, uri: record.local_uri, size: record.file_size, title: item?.title ?? 'Saved media', item };
  }));
}

export default function Downloads() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [rows, setRows] = useState<DownloadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try {
      const next = await loadDownloadRows(userId);
      setRows(next);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (!userId) {
        if (active) { setRows([]); setLoading(false); }
        return;
      }
      try {
        const next = await loadDownloadRows(userId);
        if (active) { setRows(next); setLoading(false); }
      } catch {
        if (active) { setRows([]); setLoading(false); }
      }
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  const totalSize = rows.reduce((sum, row) => sum + row.size, 0);
  const clearAll = () => Alert.alert('Remove all device downloads?', 'This removes media files from this device only. Your saved links remain in the library.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove downloads', style: 'destructive', onPress: async () => {
      if (!userId) return;
      for (const row of rows) {
        await deleteDownloadedMedia(userId, row.itemId);
        void logProductEvent(userId, 'download_deleted');
      }
      await reload();
    } },
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={[type.h2 as any, { color: colors.text }]}>Downloads & storage</Text>
        <Text style={{ color: colors.textSecondary, marginTop: spacing.xs }}>{rows.length} device file{rows.length === 1 ? '' : 's'} · {formatSize(totalSize)}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.xs }}>Files stay on this device. Removing a file never deletes its saved link.</Text>
      </View>
      {loading ? <Text style={{ color: colors.textMuted, padding: spacing.xl }}>Loading device files…</Text> : rows.length === 0 ? (
        <KIBEmptyState icon="download" title="No downloads yet" message="Direct media links that pass the file and permission checks can be downloaded from their detail page. Social links remain references." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.itemId}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable style={{ flex: 1 }} onPress={() => item.item && router.push(`/content/${item.item.id}`)} accessibilityRole="button">
                <Text style={[type.label as any, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{formatSize(item.size)} · stored only on this device</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => void new File(item.uri).preview({ title: item.title }).catch(() => Alert.alert('File unavailable', 'This download is no longer available.'))} style={styles.action}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>Open</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} onPress={() => Alert.alert('Remove device file?', 'The saved link will remain in your library.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: async () => {
                  if (userId) { await deleteDownloadedMedia(userId, item.itemId); void logProductEvent(userId, 'download_deleted'); }
                  await reload();
                } },
              ])} style={styles.action}>
                <Text style={{ color: colors.error, fontSize: 16 }}>×</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      {rows.length ? <KIBButton label="Remove all downloads" variant="secondary" onPress={clearAll} style={{ marginHorizontal: spacing.xl }} /> : null}
      <KIBButton label="Back" variant="ghost" onPress={() => safeBack(router, '/settings')} style={{ margin: spacing.xl }} />
    </View>
  );
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md },
  action: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
