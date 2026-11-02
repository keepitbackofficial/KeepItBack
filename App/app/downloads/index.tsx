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
import { useDownloads } from '../../src/store/useDownloads';
import { KIBButton, KIBEmptyState } from '../../src/components/KIBPrimitives';
import { SavedItem } from '../../src/types';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { colors, fontFamily, radius, spacing, type } from '../../src/theme';
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
  const jobs = useDownloads((state) => state.jobs);
  const activeJobs = Object.values(jobs).filter((job) => job.stage === 'resolving' || job.stage === 'downloading' || job.stage === 'error');

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

  // Completed downloads land in the device-file list as soon as a job finishes.
  useEffect(() => {
    useDownloads.getState().onFinished = () => void reload();
    return () => { useDownloads.getState().onFinished = null; };
  }, [reload]);

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
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
        <Text style={[type.title, { color: colors.text }]}>Downloads & storage</Text>
        <Text style={{ color: colors.text, marginTop: spacing.xs, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{rows.length} device file{rows.length === 1 ? '' : 's'} · {formatSize(totalSize)}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs }}>Files stay on this device. Removing a file never deletes its saved link.</Text>
      </View>
      {activeJobs.length ? (
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <Text style={[type.overline, { color: colors.textMuted, marginBottom: spacing.sm }]}>Active</Text>
          {activeJobs.map((job) => (
            <View key={job.key} style={styles.row}>
              <View style={styles.fileTile}>
                {job.stage === 'error'
                  ? <FontAwesomeFreeSolid name="triangle-exclamation" size={16} color={colors.error} />
                  : <FontAwesomeFreeSolid name="download" size={16} color={colors.text} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.label, { color: colors.text, fontSize: 14 }]} numberOfLines={2}>{job.item.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {job.stage === 'error' ? job.error : job.stage === 'resolving'
                    ? 'Resolving video…'
                    : `${formatSize(job.progress.receivedBytes)}${job.progress.totalBytes ? ` / ${formatSize(job.progress.totalBytes)}` : ''} downloaded`}
                </Text>
                {job.stage === 'downloading' ? (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${jobPercent(job)}%` }]} />
                  </View>
                ) : null}
              </View>
              {job.stage === 'error' ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${job.item.title}`} style={styles.openPill}
                  onPress={() => { void useDownloads.getState().clearJob(job.key); if (userId) void useDownloads.getState().start(job.item, userId); }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>Retry</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Cancel ${job.item.title}`} style={styles.removeDot}
                  onPress={() => void useDownloads.getState().cancel(job.key)}>
                  <FontAwesomeFreeSolid name="xmark" size={13} color={colors.error} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : null}
      {loading ? <Text style={{ color: colors.textMuted, padding: spacing.xl }}>Loading device files…</Text> : rows.length === 0 ? (
        <KIBEmptyState icon="download" title="No downloads yet" message="Videos from Instagram, YouTube, Pinterest and X — and direct web media — can be downloaded from their detail pages and are listed here." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.itemId}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.fileTile}><FontAwesomeFreeSolid name="download" size={16} color={colors.text} /></View>
              <Pressable style={{ flex: 1 }} onPress={() => item.item && router.push(`/content/${item.item.id}`)} accessibilityRole="button">
                <Text style={[type.label, { color: colors.text, fontSize: 14 }]} numberOfLines={2}>{item.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{formatSize(item.size)} · stored only on this device</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => void new File(item.uri).preview({ title: item.title }).catch(() => Alert.alert('File unavailable', 'This download is no longer available.'))} style={styles.openPill}>
                <Text style={{ color: colors.text, fontSize: 13, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>Open</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} onPress={() => Alert.alert('Remove device file?', 'The saved link will remain in your library.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: async () => {
                  if (userId) { await deleteDownloadedMedia(userId, item.itemId); void logProductEvent(userId, 'download_deleted'); }
                  await reload();
                } },
              ])} style={styles.removeDot}>
                <FontAwesomeFreeSolid name="xmark" size={13} color={colors.error} />
              </Pressable>
            </View>
          )}
        />
      )}
      {rows.length ? <KIBButton label="Remove all downloads" faIcon="trash-can" variant="secondary" onPress={clearAll} style={{ marginHorizontal: spacing.xl }} /> : null}
      <KIBButton label="Back" faIcon="chevron-left" variant="ghost" onPress={() => safeBack(router, '/settings')} style={{ margin: spacing.xl, marginTop: spacing.sm }} />
    </View>
  );
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function jobPercent(job: { progress: { receivedBytes: number; totalBytes: number | null } }): number {
  const { receivedBytes, totalBytes } = job.progress;
  if (!totalBytes || totalBytes <= 0) return 0;
  return Math.min(100, Math.max(3, Math.round((receivedBytes / totalBytes) * 100)));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surface3, overflow: 'hidden', marginTop: spacing.sm },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent, minWidth: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  fileTile: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  openPill: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  removeDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.errorTint, alignItems: 'center', justifyContent: 'center' },
});
