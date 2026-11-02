import { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBCollectionRow } from '../../src/components/KIBContent';
import { KIBButton, KIBEmptyState, KIBErrorState } from '../../src/components/KIBPrimitives';
import { useLibrary } from '../../src/store/useLibrary';
import { colors, spacing, type } from '../../src/theme';
import { safeBack } from '../../src/lib/navigation';

export default function CollectionsIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collections, collectionsLoading, error, loadCollections } = useLibrary();

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[type.title, { color: colors.text }]}>Collections</Text>
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          <KIBButton label="New" faIcon="plus" onPress={() => router.push('/collections/create')} style={{ height: 38, paddingHorizontal: 14 }} />
          <KIBButton label="Join with code" faIcon="key" variant="secondary" onPress={() => router.push('/collections/join')} style={{ height: 38, paddingHorizontal: 14 }} />
        </View>
      </View>

      {collectionsLoading && collections.length === 0 ? (
        <Text style={{ color: colors.textMuted, padding: spacing.xl }}>Loading collections…</Text>
      ) : error ? (
        <KIBErrorState onRetry={() => void loadCollections()} />
      ) : collections.length === 0 ? (
        <KIBEmptyState
          icon="folder-open"
          title="No collections yet"
          message="Group saved links together — a collection exists only once you create it, and it holds only what you add."
          actionLabel="Create a collection"
          onAction={() => router.push('/collections/create')}
        />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <KIBCollectionRow collection={item} count={item.item_count ?? 0} onPress={() => router.push(`/collections/${item.id}`)} />
          )}
        />
      )}

      <KIBButton label="Back" faIcon="chevron-left" variant="ghost" onPress={() => safeBack(router, '/(tabs)/library')} style={{ margin: spacing.xl, marginTop: spacing.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
