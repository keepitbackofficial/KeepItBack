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
import { KIBKip } from '../../src/components/KIBKip';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { colors, fontFamily, radius, spacing, TAB_BAR_CLEARANCE, type } from '../../src/theme';
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
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
      showsVerticalScrollIndicator={false}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadItems({ force: true })} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={{ gap: spacing.lg }}>
          <View style={styles.brandHeader}>
            <Text style={styles.wordmark}>keepit<Text style={[styles.wordmark, { fontFamily: fontFamily.displayStrong }]}>back</Text></Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <KIBButton label="Save" faIcon="plus" onPress={() => router.push('/save')} style={{ height: 38, paddingHorizontal: 14 }} />
              <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')}>
                <KIBAvatar name={user?.fullName || user?.firstName || 'Account'} size={40} />
              </Pressable>
            </View>
          </View>

          <View style={{ paddingRight: 64 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.dot, { backgroundColor: loading ? colors.warning : colors.success }]} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fontFamily.bodyMedium }}>
                {counts ? `${counts.all} saved item${counts.all === 1 ? '' : 's'}` : 'Loading your archive…'} · {loading ? 'Syncing…' : 'Cloud library'}
              </Text>
            </View>
            <Text style={[type.title, { marginTop: 8 }]}>Good to have you back, {firstName}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 6, fontSize: 14 }}>Your saved ideas, gathered in one place.</Text>
            <KIBKip size={46} style={{ position: 'absolute', right: 4, bottom: -30 }} />
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Search your archive" onPress={() => router.push('/(tabs)/search')} style={styles.searchShortcut}>
            <FontAwesomeFreeSolid name="magnifying-glass" size={16} color={colors.text} />
            <Text style={{ color: colors.textMuted, flex: 1 }} numberOfLines={1}>Search your archive, tags, or domains…</Text>
          </Pressable>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}>
            {PLATFORM_FILTERS.map((filter) => (
              <KIBPlatformChip key={filter} platform={filter} count={counts ? (filter === 'All' ? counts.all : counts[filter] ?? 0) : undefined} active={platform === filter} onPress={() => setPlatform(filter as PlatformFilter)} />
            ))}
          </ScrollView>

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
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
  wordmark: { fontFamily: fontFamily.display, fontSize: 24, color: colors.text, letterSpacing: -0.3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  searchShortcut: { height: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 18, zIndex: 1 },
});
