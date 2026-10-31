import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '../../src/auth/AuthProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBCollectionCard, KIBContentRow } from '../../src/components/KIBContent';
import { KIBPlatformChip } from '../../src/components/KIBPlatformLogo';
import { KIBAvatar, KIBButton, KIBEmptyState, KIBErrorState, SectionHeader } from '../../src/components/KIBPrimitives';
import { KIBText as Text } from '../../src/components/KIBText';
import { useLibrary } from '../../src/store/useLibrary';
import { colors, fontFamily, radius, spacing, type } from '../../src/theme';
import { PLATFORM_FILTERS, PlatformFilter, SavedItem } from '../../src/types';

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { items, counts, platform, loading, error, collections, loadItems, loadCollections, setPlatform } = useLibrary();

  useEffect(() => {
    void loadItems();
    void loadCollections();
  }, [loadItems, loadCollections]);

  const isEmpty = (counts?.all ?? 0) === 0;
  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'there';

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 28 }}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadItems({ force: true })} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={{ gap: spacing.lg }}>
          <View style={styles.brandHeader}>
            <View>
              <Text style={[type.h1, { fontSize: 28, lineHeight: 34 }]}>KeepItBack</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 0.5 }}>SAVE ANYTHING. FIND EVERYTHING.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')}>
              <KIBAvatar name={user?.fullName || user?.firstName || 'Account'} size={42} />
            </Pressable>
          </View>

          <View style={styles.archiveMeta}>
            <View>
              <Text style={{ color: colors.accent, fontFamily: fontFamily.bodyMedium, fontSize: 11, letterSpacing: 1.2 }}>YOUR PRIVATE ARCHIVE</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>{counts ? `${counts.all} saved item${counts.all === 1 ? '' : 's'}` : 'Loading your archive…'}</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{loading ? 'Syncing…' : 'Cloud library'}</Text>
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Search your archive" onPress={() => router.push('/(tabs)/search')} style={styles.searchShortcut}>
            <Text style={{ color: colors.textMuted, fontSize: 17 }}>⌕</Text>
            <Text style={{ color: colors.textMuted, flex: 1 }}>Search your archive, tags, or domains…</Text>
            <Text style={{ color: colors.accent, fontSize: 18 }}>⌘</Text>
          </Pressable>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}>
            {PLATFORM_FILTERS.map((filter) => (
              <KIBPlatformChip key={filter} platform={filter} count={counts ? (filter === 'All' ? counts.all : counts[filter] ?? 0) : undefined} active={platform === filter} onPress={() => setPlatform(filter as PlatformFilter)} />
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={[type.h2, { fontSize: 24 }]}>Good to have you back, {firstName}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 3 }}>Your saved ideas, gathered in one place.</Text>
            </View>
            <KIBButton label="+ Save" onPress={() => router.push('/save')} style={{ height: 44, paddingHorizontal: 14 }} />
          </View>

          {collections.length ? (
            <View>
              <SectionHeader title="Collections" actionLabel="See all" onAction={() => router.push('/collections')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {collections.slice(0, 8).map((collection) => (
                  <KIBCollectionCard key={collection.id} collection={collection} count={collection.item_count ?? 0} onPress={() => router.push(`/collections/${collection.id}`)} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <SectionHeader title="Recently saved" actionLabel="Open library" onAction={() => router.push('/(tabs)/library')} />
          {error ? <KIBErrorState message={error} onRetry={() => void loadItems({ force: true })} /> : null}
          {isEmpty && !loading ? (
            <KIBEmptyState icon="link" title="Your archive starts with a link" message="Share or paste a link to save it for later. It will appear here as soon as it is synced." actionLabel="Save a link" onAction={() => router.push('/save')} />
          ) : null}
        </View>
      }
      renderItem={({ item }: { item: SavedItem }) => <KIBContentRow item={item} onPress={() => router.push(`/content/${item.id}`)} />}
      ListEmptyComponent={loading ? <View style={{ height: 24 }} /> : <View />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  archiveMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill },
  searchShortcut: { height: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
});
