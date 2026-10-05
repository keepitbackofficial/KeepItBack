import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBDownloadButton, KIBThumbnail } from '../../src/components/KIBContent';
import { KIBButton, KIBEmptyState, KIBFilterChip } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

/** SCREEN 21/22 — DOWNLOADS + progress. */
export default function Downloads() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useStore((s) => s.items);
  const [filter, setFilter] = useState<'All' | 'Videos' | 'Images'>('All');

  const downloaded = useMemo(
    () =>
      items
        .filter((i) => i.downloadState === 'downloaded' || i.downloadState === 'downloading')
        .filter((i) => {
          if (filter === 'Videos') return ['Video', 'Reel', 'Short'].includes(i.contentType);
          if (filter === 'Images') return i.contentType === 'Image';
          return true;
        }),
    [items, filter],
  );
  const totalMb = items
    .filter((i) => i.downloadState === 'downloaded')
    .reduce((s, i) => s + (i.downloadSizeMb ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }}>
      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={[type.h1 as any, { color: colors.text }]}>Downloads</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
          {items.filter((i) => i.downloadState === 'downloaded').length} items •{' '}
          {totalMb >= 1024 ? `${(totalMb / 1024).toFixed(1)} GB` : `${Math.round(totalMb)} MB`}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
        {(['All', 'Videos', 'Images'] as const).map((f) => (
          <KIBFilterChip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>

      {downloaded.length === 0 ? (
        <KIBEmptyState
          emoji="⬇️"
          title="No downloads yet"
          message="Open any saved item and choose Save to Device for supported content."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {downloaded.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={{ width: 92 }}>
                <KIBThumbnail item={item} height={68} borderRadius={radius.sm} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {item.downloadState === 'downloading'
                    ? `Downloading... ${Math.round(item.downloadProgress * 100)}%`
                    : `${(item.downloadSizeMb ?? 0).toFixed(1)} MB`}
                </Text>
                {item.downloadState === 'downloading' ? (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(item.downloadProgress * 100)}%` }]} />
                  </View>
                ) : (
                  <Text style={{ color: colors.success, fontSize: 12, marginTop: 2 }}>✓ Available Offline</Text>
                )}
              </View>
              <View style={{ width: 130 }}>
                <KIBDownloadButton item={item} compact />
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={{ padding: spacing.xl }}>
        <KIBButton label="Manage Storage" variant="secondary" onPress={() => router.push('/downloads/storage')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  progressTrack: { height: 4, backgroundColor: colors.surface2, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
});
