import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchCollectionWithItems, addCollectionItem } from '../../src/api/collections';
import { KIBContentRow } from '../../src/components/KIBContent';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { useLibrary } from '../../src/store/useLibrary';
import { colors, spacing, type } from '../../src/theme';

export default function AddToCollection() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, counts, loading, loadItems, setFilters } = useLibrary();
  const [included, setIncluded] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setFilters({ platform: 'All', contentType: 'All', category: 'All', dateFrom: undefined, dateTo: undefined, downloadedOnly: false });
    void (async () => {
      if (!collectionId) return;
      const result = await fetchCollectionWithItems(collectionId);
      if (result.data) setIncluded(result.data.items.map((item) => item.id));
      else if (result.error) Alert.alert('Could not load collection', result.error);
    })();
  }, [collectionId, setFilters]);

  const available = items.filter((item) => !included.includes(item.id) && !item.id.startsWith('local:'));
  const hasMore = Boolean(counts?.all && items.length < counts.all);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={[type.h3 as any, { color: colors.text }]}>Add your saved links</Text>
        <Text style={{ color: colors.textSecondary, marginTop: spacing.xs }}>Only links saved to your own library can be added.</Text>
      </View>
      {available.length || hasMore ? (
        <FlatList
          data={available}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm }}
          onEndReached={() => {
            if (counts?.all && items.length < counts.all) void loadItems({ loadMore: true });
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.md }}>All currently loaded links are already in this collection.</Text>}
          ListFooterComponent={hasMore ? <KIBButton label={loading ? 'Loading…' : 'Load more saved links'} variant="secondary" disabled={loading} onPress={() => void loadItems({ loadMore: true })} style={{ marginTop: spacing.md }} /> : undefined}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}><KIBContentRow item={item} onPress={() => router.push(`/content/${item.id}`)} /></View>
              <KIBButton label={busyId === item.id ? 'Adding…' : 'Add'} disabled={busyId !== null} onPress={async () => {
                if (!collectionId) return;
                setBusyId(item.id);
                const result = await addCollectionItem(collectionId, item.id);
                setBusyId(null);
                if (result.error) Alert.alert('Could not add link', result.error);
                else setIncluded((current) => [...current, item.id]);
              }} />
            </View>
          )}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>No saved links are available to add. New links you save will appear here.</Text>
        </View>
      )}
      <KIBButton label="Done" variant="ghost" onPress={() => router.back()} style={{ margin: spacing.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.bg } });
