import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBContentCard, KIBModal } from '../../src/components/KIBContent';
import { KIBButton, KIBIconButton, SectionHeader } from '../../src/components/KIBPrimitives';
import { paletteFor, colors, radius, spacing, type } from '../../src/theme';
import { useStore } from '../../src/store/useStore';

/** SCREEN 17 — COLLECTION DETAILS. */
export default function CollectionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collections, items, deleteCollection } = useStore();
  const [confirm, setConfirm] = useState(false);
  const collection = collections.find((c) => c.id === id);

  if (!collection) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl }}>
        <Text style={{ color: colors.textMuted }}>Collection not found.</Text>
      </View>
    );
  }

  const collectionItems = collection.itemIds
    .map((itemId) => items.find((i) => i.id === itemId))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  const [from, to] = paletteFor(collection.id + collection.name);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <KIBIconButton icon="←" label="Go back" onPress={() => router.back()} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
          {collection.name}
        </Text>
        <KIBIconButton icon="⋮" label="Collection options" onPress={() => setConfirm(true)} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.cover, { backgroundColor: from }]}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: to, opacity: 0.25 }} />
          <Text style={{ fontSize: 44 }}>{collection.emoji}</Text>
        </View>
        <View style={{ padding: spacing.xl }}>
          <Text style={[type.h2 as any, { color: colors.text }]}>
            {collection.emoji} {collection.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
            {collectionItems.length} saved items{collection.description ? ` • ${collection.description}` : ''}
          </Text>

          {collectionItems.length === 0 ? (
            <Text style={{ color: colors.textMuted, marginTop: spacing.xl, textAlign: 'center' }}>
              Nothing in this collection yet.{'\n'}Open a saved item → Add to Collection.
            </Text>
          ) : (
            <>
              <View style={{ marginTop: spacing.xl }}>
                <SectionHeader title="Items" />
              </View>
              <View style={styles.grid}>
                {collectionItems.map((item) => (
                  <KIBContentCard key={item.id} item={item} width="48.5%" onPress={() => router.push(`/content/${item.id}`)} />
                ))}
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <KIBButton label="Share" variant="secondary" style={{ flex: 1 }} onPress={() => {}} />
            <KIBButton label="Edit" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/collections/create')} />
          </View>
        </View>
      </ScrollView>

      <KIBModal visible={confirm} onClose={() => setConfirm(false)} title="Delete collection?">
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          "{collection.name}" will be deleted. Saved items stay in your library.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <KIBButton label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
          <KIBButton
            label="Delete"
            variant="danger"
            style={{ flex: 1 }}
            onPress={() => {
              deleteCollection(collection.id);
              router.back();
            }}
          />
        </View>
      </KIBModal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  cover: { height: 140, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
