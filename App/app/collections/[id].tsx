import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchCollectionWithItems, updateCollection, deleteCollection } from '../../src/api/collections';
import { KIBContentRow } from '../../src/components/KIBContent';
import { KIBButton, KIBEmptyState, KIBErrorState } from '../../src/components/KIBPrimitives';
import { SavedItem } from '../../src/types';
import { colors, spacing, type } from '../../src/theme';

export default function CollectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const res = await fetchCollectionWithItems(id);
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error ?? 'Collection not found.');
      return;
    }
    setName(res.data.collection.name);
    setItems(res.data.items);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!id) return;
      const res = await fetchCollectionWithItems(id);
      if (cancelled) return;
      if (res.error || !res.data) {
        setError(res.error ?? 'Collection not found.');
        setLoading(false);
        return;
      }
      setName(res.data.collection.name);
      setItems(res.data.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const retry = () => {
    void (async () => {
      if (!id) return;
      setLoading(true);
      const res = await fetchCollectionWithItems(id);
      if (res.error || !res.data) {
        setError(res.error ?? 'Collection not found.');
        setLoading(false);
        return;
      }
      setName(res.data.collection.name);
      setItems(res.data.items);
      setLoading(false);
    })();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Loading collection…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <KIBErrorState onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {renaming ? (
          <TextInput value={name} onChangeText={setName} accessibilityLabel="Collection name" style={styles.renameInput} />
        ) : (
          <Text style={[type.h3 as any, { color: colors.text, flex: 1 }]}>{name}</Text>
        )}
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{items.length} item{items.length === 1 ? '' : 's'}</Text>
      </View>

      {items.length === 0 ? (
        <KIBEmptyState emoji="📭" title="Empty collection" message="Add saved links to this collection from any item's Collections action." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, marginTop: spacing.md, paddingBottom: 40, gap: spacing.md }}
          renderItem={({ item }) => <KIBContentRow item={item} onPress={() => router.push(`/content/${item.id}`)} />}
        />
      )}

      <View style={{ paddingHorizontal: spacing.xl, gap: 8, paddingBottom: insets.bottom + 24 }}>
        <KIBButton
          label={renaming ? (busy ? 'Renaming…' : 'Save name') : 'Rename collection'}
          variant="secondary"
          disabled={busy}
          onPress={async () => {
            if (!id) return;
            if (renaming) {
              if (!name.trim()) return;
              setBusy(true);
              const res = await updateCollection(id, { name: name.trim() });
              setBusy(false);
              if (res.error) {
                Alert.alert('Rename failed', res.error);
                return;
              }
            }
            setRenaming((r) => !r);
          }}
        />
        <KIBButton
          label="Delete collection"
          variant="danger"
          onPress={() => {
            Alert.alert('Delete collection', 'Items stay in your library; only this grouping is removed.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  if (!id) return;
                  const res = await deleteCollection(id);
                  if (res.error) {
                    Alert.alert('Delete failed', res.error);
                    return;
                  }
                  router.back();
                },
              },
            ]);
          }}
        />
        <KIBButton label="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  renameInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
  },
});
