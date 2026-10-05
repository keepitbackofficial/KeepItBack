import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBCollectionRow } from '../../src/components/KIBContent';
import { KIBButton, KIBEmptyState, KIBIconButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, spacing, type } from '../../src/theme';

/** SCREEN 16 — COLLECTION LIST. */
export default function Collections() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const collections = useStore((s) => s.collections);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl }}>
        <Text style={[type.h1 as any, { color: colors.text }]}>Collections</Text>
        <KIBIconButton icon="＋" label="Create collection" onPress={() => router.push('/collections/create')} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
        Your collections
      </Text>

      {collections.length === 0 ? (
        <KIBEmptyState
          emoji="🗂️"
          title="No collections yet"
          message="Group saved content into collections like Travel, Coding or Recipes."
          actionLabel="+ Create Collection"
          onAction={() => router.push('/collections/create')}
        />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40 }}
          renderItem={({ item: c }) => (
            <KIBCollectionRow collection={c} count={c.itemIds.length} onPress={() => router.push(`/collections/${c.id}`)} />
          )}
        />
      )}
    </View>
  );
}
