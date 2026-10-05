import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBContentRow } from '../../src/components/KIBContent';
import { KIBEmptyState, KIBContentCardSkeleton } from '../../src/components/KIBPrimitives';
import { searchItems } from '../../src/lib/search';
import { useStore } from '../../src/store/useStore';
import { colors, spacing, type } from '../../src/theme';

const SUGGESTED = ['places I wanted to visit', 'videos about React', 'Hyderabad', 'buy later'];

/** SCREEN 08/09 — SEARCH + live results with debounce (spec §45). */
export default function Search() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, recentSearches, addRecentSearch, clearRecentSearches } = useStore();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setSearching(query.trim().length > 0 && query !== debounced);
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query, debounced]);

  const results = useMemo(() => (debounced.trim() ? searchItems(items, debounced) : []), [items, debounced]);

  useEffect(() => {
    if (debounced.trim().length > 1) addRecentSearch(debounced.trim());
  }, [debounced]);

  const submitOrOpen = (q: string) => {
    addRecentSearch(q);
    setQuery(q);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }}>
      <View style={styles.searchRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Go back">
          <Text style={{ color: colors.text, fontSize: 20 }}>←</Text>
        </Pressable>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          autoFocus
          placeholder="Search saved content"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Search saved content"
          style={styles.input}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {debounced.trim() === '' ? (
        <View style={{ padding: spacing.xl }}>
          {recentSearches.length > 0 ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[type.h3 as any, { color: colors.text }]}>Recent searches</Text>
                <Pressable onPress={clearRecentSearches} hitSlop={8}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Clear</Text>
                </Pressable>
              </View>
              {recentSearches.map((r) => (
                <Pressable key={r} onPress={() => submitOrOpen(r)} style={styles.recentRow} accessibilityLabel={`Search ${r}`}>
                  <Text style={{ marginRight: 10 }}>🕘</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{r}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          <Text style={[type.h3 as any, { color: colors.text, marginTop: spacing.xl }]}>Suggested</Text>
          {SUGGESTED.map((s) => (
            <Pressable key={s} onPress={() => submitOrOpen(s)} style={styles.recentRow} accessibilityLabel={`Try ${s}`}>
              <Text style={{ marginRight: 10 }}>✨</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' }}>"{s}"</Text>
            </Pressable>
          ))}
        </View>
      ) : searching ? (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <KIBContentCardSkeleton key={i} />
          ))}
        </View>
      ) : results.length === 0 ? (
        <KIBEmptyState
          emoji="🔍"
          title="Nothing found"
          message={`Try a broader keyword or search using what you remember.\n\nSuggestions: "travel", "food", "react"`}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {results.length} result{results.length === 1 ? '' : 's'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>✨ ranked by relevance</Text>
          </View>
          <FlatList
            data={results}
            keyExtractor={(r) => r.item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40 }}
            renderItem={({ item: r }) => (
              <KIBContentRow
                item={r.item}
                keywords={r.item.aiState === 'done' ? r.item.aiKeywords : undefined}
                onPress={() => router.push(`/content/${r.item.id}`)}
              />
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    height: 46,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 23,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
