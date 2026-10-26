import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBContentCard, KIBContentRow } from '../../src/components/KIBContent';
import { KIBButton, KIBEmptyState, KIBErrorState, SectionHeader } from '../../src/components/KIBPrimitives';
import { useLibrary } from '../../src/store/useLibrary';
import { colors, spacing, type } from '../../src/theme';
import { SavedItem } from '../../src/types';

/**
 * SCREEN — HOME. Feeds only from real Supabase rows for the signed-in
 * user. Counts are aggregate `count` values from the database, not
 * guesses. Empty library explains how to save the first item.
 */
export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, counts, loading, error, loadItems } = useLibrary();

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  if (loading && items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl, gap: spacing.md }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.skeletonCard, { height: 96 }]} />
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <KIBErrorState message={error} onRetry={() => void loadItems()} />
      </View>
    );
  }

  const isEmpty = (counts?.all ?? 0) === 0;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 40 }}
      data={items}
      keyExtractor={(i) => i.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadItems()} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Your library</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {counts
                  ? `${counts.all} saved item${counts.all === 1 ? '' : 's'} from the database`
                  : 'Counting your saved items…'}
              </Text>
            </View>
            <KIBButton label="+ Save url" onPress={() => router.push('/save')} />
          </View>
          {isEmpty ? <Text style={[type.h1 as any, { color: colors.text }]}>Nothing here yet</Text> : null}
        </View>
      }
      ListEmptyComponent={
        isEmpty ? (
          <View style={{ marginTop: spacing.xxl }}>
            <KIBEmptyState
              emoji="📥"
              title="Save your first link"
              message="Paste an Instagram Reel, TikTok, YouTube video, or any web link with the + button. KeepItBack stores the reference and finds it whenever you search."
              actionLabel="Save a link"
              onAction={() => router.push('/save')}
            />
          </View>
        ) : (
          <View />
        )
      }
      renderItem={({ item }: { item: SavedItem }) => (
        <KIBContentRow item={item} onPress={() => router.push(`/content/${item.id}`)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  skeletonCard: { backgroundColor: colors.surface2, borderRadius: 12 },
});
