import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBContentRow } from '../../src/components/KIBContent';
import { KIBPlatformChip } from '../../src/components/KIBPlatformLogo';
import { KIBButton, KIBEmptyState, KIBErrorState } from '../../src/components/KIBPrimitives';
import { useLibrary } from '../../src/store/useLibrary';
import { CONTENT_TYPE_FILTERS, DEFAULT_CATEGORIES, PLATFORM_FILTERS, PlatformFilter, SavedItem } from '../../src/types';
import { fetchCategories } from '../../src/api/items';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SCREEN — LIBRARY. All rows belong to the signed-in user, ordered by
 * saved_at desc straight from PostgreSQL. Legends/counts are real
 * aggregate counts fetched from the db, never simulated.
 */
export default function Library() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, counts, platform, filters, loading, error, offline, pendingCount, syncState, loadItems, setPlatform, setFilters } = useLibrary();
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES]);

  useEffect(() => {
    void loadItems();
  }, [platform, filters, loadItems]);
  useEffect(() => {
    void fetchCategories().then((result) => {
      if ('data' in result) setCategories([...new Set([...DEFAULT_CATEGORIES, ...result.data])]);
    });
  }, []);

  const hasMore = counts ? items.length < counts[platform === 'All' ? 'all' : platform] : false;

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
            {offline ? 'Offline copy' : counts ? `${counts.all} saved item${counts.all === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {pendingCount > 0 ? <Pressable onPress={() => void loadItems({ force: true })} accessibilityRole="button"><Text style={{ color: syncState === 'retry' ? colors.error : colors.accent, fontSize: 11 }}>{syncState === 'syncing' ? 'Syncing…' : syncState === 'retry' ? `${pendingCount} need a retry · tap` : `${pendingCount} waiting to sync · tap`}</Text></Pressable> : null}
            <KIBButton label="Collections" variant="secondary" onPress={() => router.push('/collections')} />
          </View>
      </View>

      <View style={styles.filterRow}>
        {PLATFORM_FILTERS.map((f: PlatformFilter) => {
          const active = platform === f;
          return (
            <KIBPlatformChip
              key={f}
              platform={f}
              count={counts ? (f === 'All' ? counts.all : counts[f] ?? 0) : undefined}
              active={active}
              onPress={() => setPlatform(f)}
            />
          );
        })}
      </View>

      <Pressable onPress={() => setShowFilters((visible) => !visible)} style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
        <Text style={{ color: colors.accent, fontSize: 13 }}>{showFilters ? 'Hide filters' : 'Filter by type, category, date, or download'}</Text>
      </Pressable>
      {showFilters ? (
        <ScrollView style={{ maxHeight: 180, marginTop: spacing.xs }} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Content type</Text>
          <View style={styles.filterRow}>{CONTENT_TYPE_FILTERS.map((value) => <KIBButton key={value} label={value} variant={filters.contentType === value ? 'primary' : 'secondary'} onPress={() => setFilters({ contentType: value })} style={{ height: 34, paddingHorizontal: spacing.sm }} />)}</View>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Category</Text>
          <View style={styles.filterRow}>{['All', ...categories].map((value) => <KIBButton key={value} label={value} variant={filters.category === value ? 'primary' : 'secondary'} onPress={() => setFilters({ category: value })} style={{ height: 34, paddingHorizontal: spacing.sm }} />)}</View>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Saved date · enter YYYY-MM-DD</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput value={filters.dateFrom ?? ''} onChangeText={(dateFrom) => setFilters({ dateFrom: dateFrom || undefined })} placeholder="From" placeholderTextColor={colors.textMuted} style={styles.dateInput} />
            <TextInput value={filters.dateTo ?? ''} onChangeText={(dateTo) => setFilters({ dateTo: dateTo || undefined })} placeholder="To" placeholderTextColor={colors.textMuted} style={styles.dateInput} />
          </View>
          <KIBButton label={filters.downloadedOnly ? '✓ Downloaded only' : 'Downloaded only'} variant={filters.downloadedOnly ? 'primary' : 'secondary'} onPress={() => setFilters({ downloadedOnly: !filters.downloadedOnly })} />
          <KIBButton label="Clear advanced filters" variant="ghost" onPress={() => setFilters({ contentType: 'All', category: 'All', dateFrom: undefined, dateTo: undefined, downloadedOnly: false })} />
        </ScrollView>
      ) : null}

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
            if (hasMore && !loading) void loadItems({ loadMore: true });
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
  dateInput: { flex: 1, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.sm },
});
