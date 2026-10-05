import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBBottomSheet, KIBContentCard } from '../../src/components/KIBContent';
import { KIBEmptyState, KIBFilterChip, KIBIconButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, spacing, type } from '../../src/theme';
import { ContentType, SavedItem } from '../../src/types';

type TypeFilter = 'All' | ContentType;
type Sort = 'Recently saved' | 'Recently opened' | 'A–Z' | 'Oldest' | 'Most used';

const TYPE_FILTERS: TypeFilter[] = ['All', 'Video', 'Reel', 'Short', 'Post', 'Image', 'Article', 'Link'];
const SORTS: Sort[] = ['Recently saved', 'Recently opened', 'A–Z', 'Oldest', 'Most used'];

/** SCREEN 15 — LIBRARY. */
export default function Library() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useStore((s) => s.items);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [sort, setSort] = useState<Sort>('Recently saved');
  const [sortOpen, setSortOpen] = useState(false);

  const visible = useMemo(() => {
    const videoish: ContentType[] = ['Video', 'Reel', 'Short'];
    let list = items.filter((i) => !i.isArchived);
    if (typeFilter === 'Video') list = list.filter((i) => videoish.includes(i.contentType));
    else if (typeFilter !== 'All') list = list.filter((i) => i.contentType === typeFilter);
    const sorted = [...list];
    switch (sort) {
      case 'Recently saved': sorted.sort((a, b) => b.savedAt - a.savedAt); break;
      case 'Recently opened': sorted.sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0)); break;
      case 'A–Z': sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'Oldest': sorted.sort((a, b) => a.savedAt - b.savedAt); break;
      case 'Most used': sorted.sort((a, b) => b.openCount - a.openCount); break;
    }
    return sorted;
  }, [items, typeFilter, sort]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl }}>
        <Text style={[type.h1 as any, { color: colors.text }]}>Library</Text>
        <KIBIconButton icon="⋮" label="Library options" onPress={() => router.push('/collections')} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.xl, marginTop: 2 }}>
        {visible.length} saved
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
        {TYPE_FILTERS.map((t) => (
          <KIBFilterChip key={t} label={t} active={typeFilter === t} onPress={() => setTypeFilter(t)} />
        ))}
      </ScrollView>

      <Pressable onPress={() => setSortOpen(true)} style={{ flexDirection: 'row', paddingHorizontal: spacing.xl, marginTop: spacing.md }} accessibilityLabel={`Sort: ${sort}`}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Sort: {sort} ▾</Text>
      </Pressable>

      {visible.length === 0 ? (
        <KIBEmptyState
          emoji="📚"
          title="Nothing here yet"
          message="Save something you find useful, funny or interesting."
          actionLabel="+ Save Something"
          onAction={() => router.push('/save')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.gridWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {visible.map((item: SavedItem) => (
              <KIBContentCard key={item.id} item={item} width="48.5%" onPress={() => router.push(`/content/${item.id}`)} />
            ))}
          </View>
        </ScrollView>
      )}

      <KIBBottomSheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        {SORTS.map((s) => (
          <Pressable
            key={s}
            onPress={() => {
              setSort(s);
              setSortOpen(false);
            }}
            style={styles.sortRow}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${s}`}
          >
            <Text style={{ color: sort === s ? colors.accentSoft : colors.text, fontSize: 15 }}>{s}</Text>
            {sort === s ? <Text style={{ color: colors.accentSoft }}>✓</Text> : null}
          </Pressable>
        ))}
      </KIBBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  gridWrap: { padding: spacing.xl, paddingBottom: 100 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
});
