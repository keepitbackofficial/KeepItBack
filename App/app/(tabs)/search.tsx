import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
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
import { colors, radius, spacing, type } from '../../src/theme';

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
      <Text style={[type.h3 as any, { color: colors.text, paddingHorizontal: spacing.xl }]}>Search your library</Text>
      <View style={[styles.inputWrap, { marginHorizontal: spacing.xl, marginTop: spacing.md }]}>
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
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>×</Text>
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
        <ScrollView style={{ maxHeight: 195, marginTop: spacing.xs }} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.sm }}>
          <Text style={styles.filterLabel}>Platform</Text>
          <View style={styles.filterRow}>{PLATFORM_FILTERS.map((f: PlatformFilter) => <KIBPlatformChip key={f} platform={f} active={filters.platform === f} onPress={() => setFilters((current) => ({ ...current, platform: f }))} />)}</View>
          <Text style={styles.filterLabel}>Content type</Text>
          <View style={styles.filterRow}>{CONTENT_TYPE_FILTERS.map((value) => <KIBFilterChip key={value} label={value} active={filters.contentType === value} onPress={() => setFilters((current) => ({ ...current, contentType: value }))} />)}</View>
          <Text style={styles.filterLabel}>Category</Text>
          <View style={styles.filterRow}>{['All', ...categories].map((value) => <KIBFilterChip key={value} label={value} active={filters.category === value} onPress={() => setFilters((current) => ({ ...current, category: value }))} />)}</View>
          <Text style={styles.filterLabel}>Saved date</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput value={filters.dateFrom ?? ''} onChangeText={(dateFrom) => setFilters((current) => ({ ...current, dateFrom: dateFrom || undefined }))} placeholder="From · YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.dateInput} />
            <TextInput value={filters.dateTo ?? ''} onChangeText={(dateTo) => setFilters((current) => ({ ...current, dateTo: dateTo || undefined }))} placeholder="To · YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.dateInput} />
          </View>
        </ScrollView>
      ) : null}

      {!hasQuery && recent.length ? (
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <Text style={[type.label as any, { color: colors.textSecondary, marginBottom: spacing.sm }]}>Recent searches</Text>
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
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40, gap: spacing.md }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.md }}>
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
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  input: { flex: 1, height: 48, color: colors.text, fontSize: 15 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, paddingBottom: spacing.sm },
  filterLabel: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs },
  dateInput: { flex: 1, height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.sm, fontSize: 12 },
});
