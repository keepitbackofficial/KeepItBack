import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBCollectionRow } from '../../src/components/KIBContent';
import { KIBButton, KIBEmptyState, KIBErrorState } from '../../src/components/KIBPrimitives';
import { useLibrary } from '../../src/store/useLibrary';
import { colors, spacing, type } from '../../src/theme';

export default function CollectionsIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collections, collectionsLoading, error, loadCollections } = useLibrary();

  useEffect(() => {
    void loadCollections();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[type.h3 as any, { color: colors.text }]}>Collections</Text>
        <KIBButton label="+ New" onPress={() => router.push('/collections/create')} />
      </View>

      {collectionsLoading && collections.length === 0 ? (
        <Text style={{ color: colors.textMuted, padding: spacing.xl }}>Loading collections…</Text>
      ) : error ? (
        <KIBErrorState onRetry={() => void loadCollections()} />
      ) : collections.length === 0 ? (
        <KIBEmptyState
          emoji="🗂️"
          title="No collections yet"
          message="Group saved links together — a collection exists only once you create it, and it holds only what you add."
          actionLabel="Create a collection"
          onAction={() => router.push('/collections/create')}
        />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <KIBCollectionRow collection={item} count={item.item_count ?? 0} onPress={() => router.push(`/collections/${item.id}`)} />
          )}
        />
      )}

      <KIBButton label="Back" variant="ghost" onPress={() => router.back()} style={{ margin: spacing.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
