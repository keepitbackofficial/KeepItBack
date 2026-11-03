import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { fetchCategories, searchItems } from '../../src/api/items';
import { logProductEvent } from '../../src/api/analytics';
import { KIBContentRow } from '../../src/components/KIBContent';
import { KIBPlatformChip } from '../../src/components/KIBPlatformLogo';
import { KIBEmptyState, KIBFilterChip } from '../../src/components/KIBPrimitives';
import { CONTENT_TYPE_FILTERS, DEFAULT_CATEGORIES, PLATFORM_FILTERS, PlatformFilter, SavedItem, SearchFilters } from '../../src/types';
import { getCachedItems, getPendingLocalItems, getRecentSearches, rememberSearch } from '../../src/lib/localStore';
import { listDownloads } from '../../src/lib/downloads';
import { useDownloads } from '../../src/store/useDownloads';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { colors, fontFamily, radius, spacing, TAB_BAR_CLEARANCE, type } from '../../src/theme';

const PAGE = 24;

/**
 * SCREEN — SEARCH. Debounced substring search against real user-owned
 * rows in Supabase (title, note, creator, url, tags). Platform filters
 * and pagination come straight from the query results. No semantic/AI
 * search is claimed — this is honest PostgreSQL text matching.
 */
export default function Search() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({ platform: 'All', contentType: 'All', category: 'All', downloadedOnly: false });
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [recent, setRecent] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<SavedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [downloadedPlatforms, setDownloadedPlatforms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string, selectedFilters: SearchFilters, offset = 0, append = false) => {
      const term = q.trim();
      const hasFilter = selectedFilters.platform !== 'All' || selectedFilters.contentType !== 'All' || selectedFilters.category !== 'All' || Boolean(selectedFilters.dateFrom || selectedFilters.dateTo || selectedFilters.downloadedOnly);
      if (!term && !hasFilter) {
        setResults([]);
        setTotal(0);
        setSearched(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      setOfflineMessage(null);
      const res = await searchItems({ query: term, filters: selectedFilters, limit: PAGE, offset });
      setLoading(false);
      setSearched(true);
      if ('error' in res) {
        try {
          if (!userId) throw new Error(res.error);
          const [cached, pending, downloads] = await Promise.all([
            getCachedItems(userId),
            getPendingLocalItems(userId),
            listDownloads(userId),
          ]);
          const downloadIds = new Set(downloads.map((download) => download.item_id));
          const candidates = [
            ...pending,
            ...cached.filter((item) => item.sync_state === 'pending' || item.sync_state === 'error'),
            ...cached.filter((item) => item.sync_state !== 'pending' && item.sync_state !== 'error'),
          ];
          const seen = new Set<string>();
          const localResults = candidates.filter((item) => {
            if (seen.has(item.canonical_url)) return false;
            seen.add(item.canonical_url);
            const haystack = [item.title, item.description, item.original_url, item.creator_name, item.creator_handle, item.note, item.category, ...(item.tags ?? [])]
              .filter(Boolean).join(' ').toLowerCase();
            return (!term || haystack.includes(term.toLowerCase()))
              && (selectedFilters.platform === 'All' || item.platform === selectedFilters.platform)
              && (!selectedFilters.contentType || selectedFilters.contentType === 'All' || item.content_type === selectedFilters.contentType)
              && (!selectedFilters.category || selectedFilters.category === 'All' || item.category === selectedFilters.category)
              && (!selectedFilters.dateFrom || item.saved_at >= selectedFilters.dateFrom)
              && (!selectedFilters.dateTo || item.saved_at <= `${selectedFilters.dateTo}T23:59:59.999Z`)
              && (!selectedFilters.downloadedOnly || downloadIds.has(item.id) || Boolean(item.remote_id && downloadIds.has(item.remote_id)));
          });
          if (!localResults.length) throw new Error('No matching items are available in the offline cache. Reconnect to search your full library.');
          setOfflineMessage('Offline · showing matching items available on this device.');
          setError(null);
          setResults(localResults.map((item) => ({ ...item, local_downloaded: downloadIds.has(item.id) || Boolean(item.remote_id && downloadIds.has(item.remote_id)) })));
          setTotal(localResults.length);
          if (term && userId) {
            try { await rememberSearch(userId, term); setRecent(await getRecentSearches(userId)); } catch { /* Recent searches remain optional when encrypted storage is unavailable. */ }
          }
        } catch (offlineError) {
          setError(offlineError instanceof Error ? offlineError.message : res.error);
          if (!append) setResults([]);
        }
        return;
      }
      setResults((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
      setTotal(res.data.total);
      if (term && userId) {
        void logProductEvent(userId, 'search_performed');
        try {
          await rememberSearch(userId, term);
          setRecent(await getRecentSearches(userId));
        } catch { /* Recent searches are device-local and optional when encrypted storage is unavailable. */ }
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    void getRecentSearches(userId).then(setRecent).catch(() => setRecent([]));
  }, [userId]);

  // Platform filter chips exist only for platforms with at least one video
  // actually downloaded to this device; they appear as soon as a download
  // completes (V4 downloaded-library UX).
  const loadDownloadedPlatforms = useCallback(async () => {
    if (!userId) { setDownloadedPlatforms(new Set()); return; }
    try {
      const [cached, pending, downloads] = await Promise.all([
        getCachedItems(userId),
        getPendingLocalItems(userId),
        listDownloads(userId),
      ]);
      const ids = new Set(downloads.map((download) => download.item_id));
      const platforms = new Set<string>();
      for (const item of [...cached, ...pending]) {
        if (ids.has(item.id) || (item.remote_id && ids.has(item.remote_id))) platforms.add(item.platform);
      }
      setDownloadedPlatforms(platforms);
    } catch {
      setDownloadedPlatforms(new Set());
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { void loadDownloadedPlatforms(); }, [loadDownloadedPlatforms]));

  useEffect(() => useDownloads.subscribe(() => {
    const done = Object.values(useDownloads.getState().jobs).some((job) => job.stage === 'done');
    if (done) void loadDownloadedPlatforms();
  }), [loadDownloadedPlatforms]);

  useEffect(() => {
    void fetchCategories().then((result) => {
      if ('data' in result) setCategories([...new Set([...DEFAULT_CATEGORIES, ...result.data])]);
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query, filters), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filters, runSearch]);

  const loadMore = () => {
    if (results.length >= total || loading) return;
    void runSearch(query, filters, results.length, true);
  };

  const hasQuery = query.trim().length > 0;
  const hasCriteria = hasQuery || filters.platform !== 'All' || filters.contentType !== 'All' || filters.category !== 'All' || Boolean(filters.dateFrom || filters.dateTo || filters.downloadedOnly);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={[type.title, { color: colors.text, paddingHorizontal: spacing.xl }]}>Search your library</Text>
      <View style={[styles.inputWrap, { marginHorizontal: spacing.xl, marginTop: spacing.lg }]}>
        <FontAwesomeFreeSolid name="magnifying-glass" size={16} color={colors.text} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search saved links, notes, tags, creators…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          accessibilityLabel="Search saved items"
          style={styles.input}
        />
        {hasQuery ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search" style={styles.clear}>
            <FontAwesomeFreeSolid name="xmark" size={12} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.filterRow, { paddingHorizontal: spacing.xl }]}>
        <KIBFilterChip label={showFilters ? 'Hide filters' : 'Filters'} active={showFilters} onPress={() => setShowFilters((visible) => !visible)} />
        <KIBFilterChip label={filters.downloadedOnly ? 'Downloaded ✓' : 'Downloaded'} active={Boolean(filters.downloadedOnly)} onPress={() => setFilters((f) => ({ ...f, downloadedOnly: !f.downloadedOnly }))} />
        {filters.platform !== 'All' ? <KIBPlatformChip platform={filters.platform ?? 'All'} active onPress={() => setFilters((f) => ({ ...f, platform: 'All' }))} /> : null}
        {filters.contentType !== 'All' ? <KIBFilterChip label={filters.contentType ?? 'All'} active onPress={() => setFilters((f) => ({ ...f, contentType: 'All' }))} /> : null}
        {filters.category !== 'All' ? <KIBFilterChip label={filters.category ?? 'All'} active onPress={() => setFilters((f) => ({ ...f, category: 'All' }))} /> : null}
      </View>
      {showFilters ? (
        <ScrollView style={styles.panel} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.sm }}>
          <Text style={styles.filterLabel}>Platform</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine}>
            {PLATFORM_FILTERS.filter((f: PlatformFilter) => f === 'All' || downloadedPlatforms.has(f)).map((f: PlatformFilter) => (
              <KIBPlatformChip key={f} platform={f} active={filters.platform === f} onPress={() => setFilters((current) => ({ ...current, platform: f }))} />
            ))}
          </ScrollView>
          <Text style={styles.filterLabel}>Content type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine}>{CONTENT_TYPE_FILTERS.map((value) => <KIBFilterChip key={value} label={value} active={filters.contentType === value} onPress={() => setFilters((current) => ({ ...current, contentType: value }))} />)}</ScrollView>
          <Text style={styles.filterLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine}>{['All', ...categories].map((value) => <KIBFilterChip key={value} label={value} active={filters.category === value} onPress={() => setFilters((current) => ({ ...current, category: value }))} />)}</ScrollView>
          <Text style={styles.filterLabel}>Saved date</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            <TextInput value={filters.dateFrom ?? ''} onChangeText={(dateFrom) => setFilters((current) => ({ ...current, dateFrom: dateFrom || undefined }))} placeholder="From · YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.dateInput} />
            <TextInput value={filters.dateTo ?? ''} onChangeText={(dateTo) => setFilters((current) => ({ ...current, dateTo: dateTo || undefined }))} placeholder="To · YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.dateInput} />
          </View>
        </ScrollView>
      ) : null}

      {!hasQuery && recent.length ? (
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <Text style={[type.overline, { color: colors.textMuted, marginBottom: spacing.xs }]}>Recent searches</Text>
          <View style={styles.filterRow}>{recent.map((term) => <KIBFilterChip key={term} label={term} onPress={() => setQuery(term)} />)}</View>
        </View>
      ) : null}

      {offlineMessage ? <Text style={{ color: colors.accent, paddingHorizontal: spacing.xl, marginTop: spacing.sm }}>{offlineMessage}</Text> : null}
      {error ? (
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: colors.error, marginBottom: spacing.md }}>{error}</Text>
          <KIBEmptyState icon="triangle-exclamation" title="Search failed" message="The database couldn't complete this search." actionLabel="Try again" onAction={() => void runSearch(query, filters)} />
        </View>
      ) : hasCriteria && loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : hasCriteria && searched && results.length === 0 ? (
        <KIBEmptyState
          icon="magnifying-glass"
          title="No saved items match"
          message={`Nothing in your library matches "${query.trim()}". Saved links never get invented here — check the spelling or save something new.`}
        />
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fontFamily.bodyMedium, marginTop: spacing.md, marginBottom: spacing.sm }}>
              {total} match{total === 1 ? '' : 'es'}
            </Text>
          }
          ListFooterComponent={
            loading && results.length > 0 ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
            ) : (
              <View />
            )
          }
          renderItem={({ item }) => <KIBContentRow item={item} onPress={() => router.push(`/content/${item.id}`)} />}
        />
      ) : !hasCriteria ? (
        <KIBEmptyState icon="magnifying-glass" title="Find anything you saved" message="Search matches saved titles, notes, creators, tags, categories, collection names, and the original link." />
      ) : (
        <KIBEmptyState icon="magnifying-glass" title="Find anything you saved" message="Search matches saved titles, notes, creators, tags, categories, collection names, and the original link." />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    gap: spacing.md,
  },
  input: { flex: 1, height: 52, color: colors.text, fontSize: 15, fontFamily: fontFamily.body },
  clear: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(28,23,24,0.08)', alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, paddingBottom: spacing.sm },
  panel: { maxHeight: 300, marginTop: spacing.xs, marginHorizontal: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  chipLine: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  filterLabel: { ...type.overline, color: colors.textMuted, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  dateInput: { flex: 1, height: 42, borderRadius: 14, backgroundColor: colors.bg, color: colors.text, paddingHorizontal: spacing.md, fontSize: 12 },
});
