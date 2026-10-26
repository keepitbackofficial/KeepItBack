import { useEffect } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBContentRow } from '../../src/components/KIBContent';
import { KIBButton, KIBEmptyState, KIBErrorState } from '../../src/components/KIBPrimitives';
import { useLibrary } from '../../src/store/useLibrary';
import { PLATFORM_FILTERS, PlatformFilter, SavedItem } from '../../src/types';
import { colors, spacing, type } from '../../src/theme';

const PAGE = 24;

/**
 * SCREEN — LIBRARY. All rows belong to the signed-in user, ordered by
 * saved_at desc straight from PostgreSQL. Legends/counts are real
 * aggregate counts fetched from the db, never simulated.
 */
export default function Library() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, counts, platform, loading, error, loadItems, setPlatform } = useLibrary();

  useEffect(() => {
    void loadItems();
  }, [platform]);

  const hasMore = counts ? items.length < counts[platform === 'All' ? 'all' : platform.toLowerCase()] : false;

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <KIBErrorState message={error} onRetry={() => void loadItems()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={[type.h3 as any, { color: colors.text }]}>Library</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {counts ? `${counts.all} item${counts.all === 1 ? '' : 's'} in the database` : ''}
          </Text>
        </View>
        <KIBButton label="Collections" variant="secondary" onPress={() => router.push('/collections')} />
      </View>

      <View style={styles.filterRow}>
        {PLATFORM_FILTERS.map((f: PlatformFilter) => {
          const label = f === 'All' ? 'All' : f;
          const active = platform === f;
          return (
            <KIBButton
              key={f}
              variant={active ? 'primary' : 'secondary'}
              label={f === 'All' && counts ? `All (${counts.all})` : `${label}${counts ? ` (${counts[f.toLowerCase()] ?? 0})` : ''}`}
              onPress={() => setPlatform(f)}
              style={{ height: 38, paddingHorizontal: spacing.md }}
            />
          );
        })}
      </View>

      {platform === 'All' && counts?.all === 0 ? (
        <KIBEmptyState
          emoji="📚"
          title="Library is empty"
          message="Save a link from Instagram, TikTok, YouTube, or anywhere on the web with the big + button — then it lands here for good."
          actionLabel="Save a link"
          onAction={() => router.push('/save')}
        />
      ) : loading && items.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : items.length === 0 ? (
        <KIBEmptyState
          emoji="🕸️"
          title={`No ${platform} saves yet`}
          message="Nothing saved from this platform yet. Every count on this page comes from what's actually in your library."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadItems()} tintColor={colors.accent} />}
          onEndReached={() => {
            if (hasMore && !loading) void loadItems();
          }}
          renderItem={({ item }: { item: SavedItem }) => <KIBContentRow item={item} onPress={() => router.push(`/content/${item.id}`)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.xl, marginTop: spacing.md },
});
