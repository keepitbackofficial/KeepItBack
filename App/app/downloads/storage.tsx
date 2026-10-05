import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton, KIBIconButton } from '../../src/components/KIBPrimitives';
import { KIBModal } from '../../src/components/KIBContent';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

const CACHE_MB = 280 / 1024;
const OTHER_MB = 20 / 1024;

/** SCREEN 23 — STORAGE MANAGER. Clearing cache never deletes saved references. */
export default function StorageManager() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, deleteLocalCopy } = useStore();
  const [cacheCleared, setCacheCleared] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const downloaded = useMemo(
    () => items.filter((i) => i.downloadState === 'downloaded'),
    [items],
  );
  const downloadsMb = downloaded.reduce((s, i) => s + (i.downloadSizeMb ?? 0), 0);
  const totalMb = downloadsMb + (cacheCleared ? 0 : CACHE_MB) + OTHER_MB;
  const largest = [...downloaded].sort((a, b) => (b.downloadSizeMb ?? 0) - (a.downloadSizeMb ?? 0)).slice(0, 5);

  const fmt = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <KIBIconButton icon="←" label="Go back" onPress={() => router.back()} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Storage</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm }}>Device storage</Text>
        <Text style={[type.h2 as any, { color: colors.text }]}>KeepItBack</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, (totalMb / (totalMb + 5120)) * 100)}%` }]} />
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>{fmt(totalMb)} used</Text>

        <View style={{ marginTop: spacing.lg, gap: 8 }}>
          <BreakRow label="Downloads" value={fmt(downloadsMb)} />
          <BreakRow label="Cache" value={cacheCleared ? '0 MB' : `${Math.round(CACHE_MB * 1024)} MB`} />
          <BreakRow label="Other" value={`${Math.round(OTHER_MB * 1024)} MB`} />
        </View>

        <Text style={[type.h3 as any, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>Downloads</Text>
        {downloaded.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>No downloaded content on this device.</Text>
        ) : (
          largest.map((i) => (
            <View key={i.id} style={styles.fileRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
                  {i.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{fmt(i.downloadSizeMb ?? 0)}</Text>
              </View>
              <KIBButton label="Delete" variant="ghost" onPress={() => setPending(i.id)} />
            </View>
          ))
        )}

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <KIBButton label="Clear Cache" variant="secondary" onPress={() => setCacheCleared(true)} />
          <KIBButton label="Manage Downloads" variant="secondary" onPress={() => router.push('/downloads')} />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.lg }}>
          Clearing cache never deletes your saved references.
        </Text>
      </ScrollView>

      <KIBModal visible={!!pending} onClose={() => setPending(null)} title="Delete downloaded copy?">
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          The local copy will be removed from this device. Your KeepItBack bookmark stays saved.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <KIBButton label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setPending(null)} />
          <KIBButton
            label="Delete"
            variant="danger"
            style={{ flex: 1 }}
            onPress={() => {
              if (pending) deleteLocalCopy(pending);
              setPending(null);
            }}
          />
        </View>
      </KIBModal>
    </View>
  );
}

function BreakRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 14 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  track: { height: 10, backgroundColor: colors.surface2, borderRadius: 5, marginTop: spacing.md, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.accent, borderRadius: 5 },
  fileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
