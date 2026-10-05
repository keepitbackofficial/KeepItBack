import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBCollectionCard, KIBContentCard, KIBThumbnail } from '../../src/components/KIBContent';
import { KIBAvatar, KIBEmptyState, KIBFilterChip, KIBSkeleton, SectionHeader } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, spacing, type } from '../../src/theme';
import { Platform } from '../../src/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const QUICK: Array<{ label: string; platform?: Platform; emoji?: string }> = [
  { label: 'All' },
  { label: 'Instagram', platform: 'Instagram' },
  { label: 'YouTube', platform: 'YouTube' },
  { label: 'TikTok', platform: 'TikTok' },
  { label: 'Other', platform: 'Other' },
];

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, collections, profile } = useStore();
  const [filter, setFilter] = useState<Platform | undefined>();

  const filtered = useMemo(
    () => items.filter((i) => !i.isArchived && (!filter || i.platform === filter)),
    [items, filter],
  );
  const recent = filtered.slice(0, 6);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[type.h2 as any, { color: colors.text }]}>
              {greeting()}, {profile.displayName}
            </Text>
            <Text style={[type.caption as any, { color: colors.textMuted, marginTop: 2 }]}>Save anything. Find everything.</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Open profile">
            <KIBAvatar name={profile.displayName} size={40} />
          </Pressable>
        </View>

        {/* Search entry */}
        <Pressable
          onPress={() => router.push('/(tabs)/search')}
          accessibilityRole="search"
          accessibilityLabel="Search your saved content"
          style={styles.searchBar}
        >
          <Text style={{ fontSize: 15, marginRight: 8 }}>🔍</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>Search your saved content...</Text>
        </Pressable>

        {/* Quick platform filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.lg }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
          {QUICK.map((q) => (
            <KIBFilterChip key={q.label} label={q.label} active={(filter ?? undefined) === q.platform} onPress={() => setFilter(q.platform)} />
          ))}
        </ScrollView>

        {/* Recently saved */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
          <SectionHeader title="Recently Saved" actionLabel="See all" onAction={() => router.push('/(tabs)/library')} />
          {recent.length === 0 ? (
            <KIBEmptyState
              emoji="📚"
              title="Your library is empty"
              message="Save something you find useful, funny or interesting."
              actionLabel="+ Save Something"
              onAction={() => router.push('/save')}
            />
          ) : (
            <View style={styles.grid}>
              {recent.map((item) => (
                <KIBContentCard key={item.id} item={item} width="48.5%" onPress={() => router.push(`/content/${item.id}`)} />
              ))}
            </View>
          )}
        </View>

        {/* Collections */}
        <View style={{ marginTop: spacing.xl }}>
          <View style={{ paddingHorizontal: spacing.xl }}>
            <SectionHeader title="Collections" actionLabel="See all" onAction={() => router.push('/collections')} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl }}>
            {collections.map((c) => (
              <KIBCollectionCard key={c.id} collection={c} count={c.itemIds.length} onPress={() => router.push(`/collections/${c.id}`)} />
            ))}
            {collections.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Create your first collection to organize saves.</Text>
            ) : null}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 26,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 0 },
});
