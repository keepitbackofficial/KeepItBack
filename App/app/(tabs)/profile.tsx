import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBAvatar, KIBIconButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, spacing, type } from '../../src/theme';

/** SCREEN 24 — PROFILE. */
export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, items, collections } = useStore();
  const downloaded = items.filter((i) => i.downloadState === 'downloaded');
  const storageMb = downloaded.reduce((sum, i) => sum + (i.downloadSizeMb ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.xl }}>
        <KIBIconButton icon="⚙️" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
        <KIBAvatar name={profile.displayName} size={84} />
        <Text style={[type.h2 as any, { color: colors.text, marginTop: spacing.md }]}>{profile.displayName}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>@{profile.username}</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={[type.h2 as any, { color: colors.text }]}>{items.filter((i) => !i.isArchived).length}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Saved</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[type.h2 as any, { color: colors.text }]}>{collections.length}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Collections</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={[type.h3 as any, { color: colors.text, marginBottom: spacing.sm }]}>My Collections</Text>
          {collections.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/collections/${c.id}`)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}
              accessibilityLabel={`Open ${c.name}`}
            >
              <Text style={{ fontSize: 18, marginRight: 10 }}>{c.emoji}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>{c.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.itemIds.length}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/collections/create')} accessibilityLabel="Create new collection">
            <Text style={{ color: colors.accentSoft, fontSize: 14, paddingTop: spacing.sm }}>+ New collection</Text>
          </Pressable>
        </View>

        <Pressable style={[styles.card, { marginTop: spacing.md }]} onPress={() => router.push('/downloads')} accessibilityLabel="Open downloads">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[type.h3 as any, { color: colors.text }]}>Downloads</Text>
            <Text style={{ color: colors.textMuted }}>›</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
            {downloaded.length} items • {storageMb >= 1024 ? `${(storageMb / 1024).toFixed(1)} GB` : `${Math.round(storageMb)} MB`}
          </Text>
        </Pressable>

        <Pressable style={[styles.card, { marginTop: spacing.md }]} onPress={() => router.push('/settings')} accessibilityLabel="Open settings">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[type.h3 as any, { color: colors.text }]}>Settings</Text>
            <Text style={{ color: colors.textMuted }}>›</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    paddingVertical: spacing.lg,
    marginVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stat: { alignItems: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
  },
});
