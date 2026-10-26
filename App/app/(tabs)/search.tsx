import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchItems } from '../../src/api/items';
import { KIBContentRow } from '../../src/components/KIBContent';
import { KIBEmptyState, KIBFilterChip } from '../../src/components/KIBPrimitives';
import { PLATFORM_FILTERS, PlatformFilter, SavedItem } from '../../src/types';
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
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<PlatformFilter>('All');
  const [results, setResults] = useState<SavedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string, p: PlatformFilter, offset = 0, append = false) => {
      const term = q.trim();
      if (!term) {
        setResults([]);
        setTotal(0);
        setSearched(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      const res = await searchItems({ query: term, platform: p, limit: PAGE, offset });
      setLoading(false);
      setSearched(true);
      if ('error' in res) {
        setError(res.error);
        if (!append) setResults([]);
        return;
      }
      setResults((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
      setTotal(res.data.total);
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query, platform), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, platform, runSearch]);

  const loadMore = () => {
    if (results.length >= total || loading) return;
    void runSearch(query, platform, results.length, true);
  };

  const hasQuery = query.trim().length > 0;

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
        {PLATFORM_FILTERS.map((f) => (
          <KIBFilterChip key={f} label={f} active={platform === f} onPress={() => setPlatform(f)} />
        ))}
      </View>

      {error ? (
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: colors.error, marginBottom: spacing.md }}>{error}</Text>
          <KIBEmptyState emoji="⚠️" title="Search failed" message="The database couldn't complete this search." actionLabel="Try again" onAction={() => void runSearch(query, platform)} />
        </View>
      ) : hasQuery && loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : hasQuery && searched && results.length === 0 ? (
        <KIBEmptyState
          emoji="🔍"
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
      ) : (
        <KIBEmptyState
          emoji="🔎"
          title="Find anything you saved"
          message="Search matches titles, notes, creator names, tag names, and the original URLs you actually saved — nothing from outside your account."
        />
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
});
