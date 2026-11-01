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
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { colors, fontFamily, radius, spacing, TAB_BAR_CLEARANCE, type } from '../../src/theme';

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
          <Text style={[type.title, { color: colors.text }]}>Library</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2, fontFamily: fontFamily.bodyMedium }}>
            {offline ? 'Offline copy' : counts ? `${counts.all} saved item${counts.all === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {pendingCount > 0 ? <Pressable onPress={() => void loadItems({ force: true })} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: syncState === 'retry' ? colors.error : colors.success }} /><Text style={{ color: syncState === 'retry' ? colors.error : colors.text, fontSize: 11, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{syncState === 'syncing' ? 'Syncing…' : syncState === 'retry' ? `${pendingCount} need a retry · tap` : `${pendingCount} waiting to sync · tap`}</Text></Pressable> : null}
            <KIBButton label="Collections" faIcon="folder" variant="secondary" onPress={() => router.push('/collections')} style={{ height: 40, paddingHorizontal: 14 }} />
          </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filterRow}>
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
      </ScrollView>

      <Pressable onPress={() => setShowFilters((visible) => !visible)} style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <FontAwesomeFreeSolid name="sliders" size={13} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 13, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{showFilters ? 'Hide filters' : 'Filter by type, category, date, or download'}</Text>
      </Pressable>
      {showFilters ? (
        <ScrollView style={styles.panel} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.sm }}>
          <Text style={styles.panelLabel}>Content type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine}>{CONTENT_TYPE_FILTERS.map((value) => <KIBButton key={value} label={value} variant={filters.contentType === value ? 'primary' : 'secondary'} onPress={() => setFilters({ contentType: value })} style={{ height: 34, paddingHorizontal: spacing.md }} />)}</ScrollView>
          <Text style={styles.panelLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine}>{['All', ...categories].map((value) => <KIBButton key={value} label={value} variant={filters.category === value ? 'primary' : 'secondary'} onPress={() => setFilters({ category: value })} style={{ height: 34, paddingHorizontal: spacing.md }} />)}</ScrollView>
          <Text style={styles.panelLabel}>Saved date · enter YYYY-MM-DD</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            <TextInput value={filters.dateFrom ?? ''} onChangeText={(dateFrom) => setFilters({ dateFrom: dateFrom || undefined })} placeholder="From" placeholderTextColor={colors.textMuted} style={styles.dateInput} />
            <TextInput value={filters.dateTo ?? ''} onChangeText={(dateTo) => setFilters({ dateTo: dateTo || undefined })} placeholder="To" placeholderTextColor={colors.textMuted} style={styles.dateInput} />
          </View>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xs, marginTop: spacing.xs }}>
            <KIBButton label="Downloaded only" faIcon={filters.downloadedOnly ? 'check' : 'download'} variant={filters.downloadedOnly ? 'primary' : 'secondary'} onPress={() => setFilters({ downloadedOnly: !filters.downloadedOnly })} style={{ height: 44 }} />
            <KIBButton label="Clear advanced filters" variant="ghost" onPress={() => setFilters({ contentType: 'All', category: 'All', dateFrom: undefined, dateTo: undefined, downloadedOnly: false })} style={{ height: 40 }} />
          </View>
        </ScrollView>
      ) : null}

      {platform === 'All' && counts?.all === 0 ? (
        <KIBEmptyState
          icon="book"
          title="Library is empty"
          message="Save a link from Instagram, TikTok, YouTube, or anywhere on the web with the big + button — then it lands here for good."
          actionLabel="Save a link"
          onAction={() => router.push('/save')}
        />
      ) : loading && items.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : items.length === 0 ? (
        <KIBEmptyState
          icon="spider"
          title={`No ${platform} saves yet`}
          message="Nothing saved from this platform yet. Every count on this page comes from what's actually in your library."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
          showsVerticalScrollIndicator={false}
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
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.lg, paddingBottom: 2 },
  panel: { maxHeight: 320, marginTop: spacing.xs, marginBottom: spacing.sm, marginHorizontal: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  panelLabel: { ...type.overline, color: colors.textMuted, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  chipLine: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  dateInput: { flex: 1, height: 42, borderRadius: 14, backgroundColor: colors.bg, color: colors.text, paddingHorizontal: spacing.md },
});
